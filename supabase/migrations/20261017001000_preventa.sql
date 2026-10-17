-- ============================================================================
-- Fase 5 · Preventa, lista de espera y saldo a favor en la tienda
-- ----------------------------------------------------------------------------
-- Preventa (pedido kind = 'preorder', un solo producto agotado):
--   pending_payment   la clienta paga el anticipo (preorder_deposit_percent)
--   deposit_paid      anticipo pagado: esperando que llegue el producto
--   awaiting_balance  llegó (la admin lo marcó): unidades apartadas para ella y
--                     preorder_balance_days días para pagar el saldo
--   paid              saldo pagado: sigue como un pedido normal
-- Si no paga el saldo a tiempo, el pedido se cancela, la unidad se libera y
-- TODO el anticipo queda como saldo a favor (decisión de la dueña, 2026-10-17).
--
-- Saldo a favor en la tienda: al crear un pedido se usa automáticamente sobre
-- lo que hay que pagar en ese momento (el total de una compra o el anticipo de
-- una preventa). Si el pedido no se paga, el saldo vuelve a sus mismos lotes.
--
-- Lista de espera: «Avísame cuando llegue», sin pago; la app envía un correo
-- (una sola vez) cuando el producto vuelve a tener unidades.
-- ============================================================================

alter table public.business_rules
  add column preorder_balance_days integer not null default 7
    check (preorder_balance_days between 1 and 60);

comment on column public.business_rules.preorder_balance_days is
  'Días que tiene la clienta para pagar el saldo de una preventa cuando llega el producto.';

alter table public.products
  add column allow_preorder boolean not null default true;

comment on column public.products.allow_preorder is 'Si está agotado, ¿se puede reservar (preventa)?';

grant update (allow_preorder) on public.products to authenticated;

create type public.order_kind as enum ('purchase', 'preorder');
create type public.payment_stage as enum ('full', 'deposit', 'balance');

alter table public.orders
  add column kind public.order_kind not null default 'purchase',
  -- Solo preventas: anticipo (sobre los productos; el envío va en el saldo).
  add column deposit_cop integer check (deposit_cop >= 0),
  -- Saldo a favor usado al crear el pedido (sobre el total o sobre el anticipo).
  add column credit_applied_cop integer not null default 0 check (credit_applied_cop >= 0),
  add column deposit_paid_at timestamptz,
  add column arrived_at timestamptz,
  add column balance_due_at timestamptz,
  add column deposit_email_sent_at timestamptz,
  add column arrival_email_sent_at timestamptz,
  add constraint orders_preorder_deposit check (
    (kind = 'preorder') = (deposit_cop is not null)
    and (deposit_cop is null or deposit_cop <= subtotal_cop)
  ),
  add constraint orders_credit_max check (credit_applied_cop <= coalesce(deposit_cop, total_cop)),
  add constraint orders_balance_due check (status <> 'awaiting_balance' or balance_due_at is not null);

create index orders_preorders_idx on public.orders (status, deposit_paid_at) where kind = 'preorder';

alter table public.order_payments
  add column stage public.payment_stage not null default 'full';

alter table public.credit_movements
  add column order_id uuid references public.orders (id) on delete restrict;

create index credit_movements_order_idx on public.credit_movements (order_id) where order_id is not null;

-- ---------------------------------------------------------------------------
-- Lista de espera
-- ---------------------------------------------------------------------------
create table public.product_waitlist (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (product_id, customer_id)
);

comment on table public.product_waitlist is 'Clientas que piden aviso cuando un producto agotado vuelva a tener unidades.';

create index product_waitlist_pending_idx on public.product_waitlist (product_id) where notified_at is null;

alter table public.product_waitlist enable row level security;

create policy "product_waitlist: clienta ve los suyos"
on public.product_waitlist for select to authenticated using (customer_id = (select auth.uid()));
create policy "product_waitlist: admin ve todos"
on public.product_waitlist for select to authenticated using ((select public.is_admin()));
create policy "product_waitlist: clienta se inscribe"
on public.product_waitlist for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (select 1 from public.products p where p.id = product_id and p.is_active)
);
create policy "product_waitlist: clienta se sale"
on public.product_waitlist for delete to authenticated using (customer_id = (select auth.uid()));

revoke all on public.product_waitlist from anon;
revoke update, truncate on public.product_waitlist from authenticated;
-- La clienta solo elige el producto: la fecha y el aviso los pone el sistema.
revoke insert on public.product_waitlist from authenticated;
grant insert (product_id, customer_id) on public.product_waitlist to authenticated;

-- ---------------------------------------------------------------------------
-- Saldo a favor de los pedidos
-- ---------------------------------------------------------------------------
-- Usa saldo (el lote que vence primero). Lo que no alcance queda como deuda
-- para revisar (solo pasa con un pago tardío).
create or replace function private.spend_order_credit(p_customer_id uuid, p_amount integer, p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left integer := p_amount;
  v_lot record;
  v_take integer;
begin
  for v_lot in
    select lot_id, remaining_cop from private.credit_lots(p_customer_id)
    where expires_at > now() and remaining_cop > 0
    order by expires_at, lot_id
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_lot.remaining_cop);
    insert into public.credit_movements (customer_id, amount_cop, reason, order_id, lot_id)
    values (p_customer_id, -v_take, 'applied_to_order', p_order_id, v_lot.lot_id);
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    insert into public.credit_movements (customer_id, amount_cop, reason, order_id)
    values (p_customer_id, -v_left, 'applied_to_order', p_order_id);
  end if;
end;
$$;

-- Devuelve a sus lotes (con su fecha original) el saldo usado en un pedido.
create or replace function private.refund_order_credit(p_customer_id uuid, p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  with net as (
    select lot_id, -sum(amount_cop)::integer as amount
    from public.credit_movements
    where order_id = p_order_id and customer_id = p_customer_id and lot_id is not null
    group by lot_id
    having sum(amount_cop) < 0
  ), inserted as (
    insert into public.credit_movements (customer_id, amount_cop, reason, order_id, lot_id)
    select p_customer_id, amount, 'hold_released', p_order_id, lot_id from net
    returning amount_cop
  )
  select coalesce(sum(amount_cop), 0)::integer into v_total from inserted;
  return v_total;
end;
$$;

-- Abono nuevo por una preventa sin pagar: vence según la política del pedido.
create or replace function private.add_order_credit(p_order public.orders, p_amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
begin
  if p_amount <= 0 then
    return;
  end if;
  select credit_validity_days into v_days from public.business_rules where version = p_order.rules_version;
  insert into public.credit_movements (customer_id, amount_cop, reason, order_id, expires_at)
  values (p_order.customer_id, p_amount, 'preorder_unpaid', p_order.id,
          now() + make_interval(days => coalesce(v_days, 15)));
end;
$$;

revoke all on function private.spend_order_credit(uuid, integer, uuid) from public;
revoke all on function private.refund_order_credit(uuid, uuid) from public;
revoke all on function private.add_order_credit(public.orders, integer) from public;

-- ---------------------------------------------------------------------------
-- Unidades apartadas: compras sin pagar a tiempo + preventas que ya llegaron.
-- ---------------------------------------------------------------------------
create or replace function private.reserved_units(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(i.quantity), 0)::integer
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where i.product_id = p_product_id
    and (
      (o.kind = 'purchase' and o.status = 'pending_payment' and o.hold_expires_at > now())
      or (o.kind = 'preorder' and o.status = 'awaiting_balance' and o.balance_due_at > now())
    )
$$;

-- Pedidos sin pagar a tiempo: vencen y devuelven el saldo usado.
-- Preventas que no pagaron el saldo a tiempo: se cancelan y el anticipo queda a favor.
create or replace function private.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_count integer := 0;
begin
  for v_order in
    update public.orders
    set status = 'expired', hold_expires_at = null
    where status = 'pending_payment' and hold_expires_at <= now()
    returning *
  loop
    if v_order.credit_applied_cop > 0 then
      perform private.refund_order_credit(v_order.customer_id, v_order.id);
    end if;
    v_count := v_count + 1;
  end loop;

  for v_order in
    update public.orders
    set status = 'cancelled', cancelled_at = now()
    where status = 'awaiting_balance' and balance_due_at <= now()
    returning *
  loop
    perform private.add_order_credit(v_order, v_order.deposit_cop);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.expire_stale_orders() from public;

-- Tarea diaria (solo servidor): vence pedidos y preventas atrasadas.
create or replace function public.expire_orders()
returns integer
language sql
security definer
set search_path = ''
as $$ select private.expire_stale_orders() $$;

revoke all on function public.expire_orders() from public, anon, authenticated;
grant execute on function public.expire_orders() to service_role;

-- Una clienta tiene un solo pedido sin pagar: los anteriores se cancelan.
create or replace function private.cancel_pending_orders(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  for v_order in
    update public.orders
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
    where customer_id = p_customer_id and status = 'pending_payment'
    returning *
  loop
    if v_order.credit_applied_cop > 0 then
      perform private.refund_order_credit(p_customer_id, v_order.id);
    end if;
  end loop;
end;
$$;

revoke all on function private.cancel_pending_orders(uuid) from public;

-- Validaciones comunes al crear un pedido o una preventa.
create or replace function private.start_order(
  p_uid uuid,
  p_rules_version integer,
  p_delivery_method public.delivery_method,
  p_address text,
  p_city text
)
returns public.business_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules public.business_rules;
begin
  if p_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform private.lock_customer(p_uid);

  select * into v_rules from public.business_rules order by version desc limit 1;
  if p_rules_version is distinct from v_rules.version then
    raise exception 'policy_changed';
  end if;

  if p_delivery_method = 'shipping' and (nullif(trim(p_address), '') is null or nullif(trim(p_city), '') is null) then
    raise exception 'invalid_delivery';
  end if;

  if exists (
    select 1 from public.orders o
    join public.order_payments p on p.order_id = o.id
    where o.customer_id = p_uid and o.status in ('pending_payment', 'awaiting_balance')
      and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  perform private.expire_stale_orders();
  perform private.cancel_pending_orders(p_uid);
  return v_rules;
end;
$$;

revoke all on function private.start_order(uuid, integer, public.delivery_method, text, text) from public;

-- ---------------------------------------------------------------------------
-- create_order: igual que antes, ahora usa el saldo a favor. Si el saldo
-- cubre todo, el pedido queda pagado sin pasar por la pasarela.
-- Errores: not_authenticated, policy_changed, invalid_items, product_unavailable,
--   out_of_stock, invalid_delivery, payment_in_progress
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_items jsonb,
  p_delivery_method public.delivery_method,
  p_recipient_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_customer_notes text,
  p_rules_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rules public.business_rules;
  v_item record;
  v_product public.products;
  v_subtotal integer := 0;
  v_shipping integer;
  v_order_id uuid;
  v_count integer;
  v_credit integer;
begin
  -- Validar la lista antes de bloquear nada: productos distintos, cantidades de 1 a 10.
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_items';
  end if;
  select count(*) into v_count from jsonb_array_elements(p_items);
  if v_count = 0 or v_count > 20 then
    raise exception 'invalid_items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e -> 'quantity') is distinct from 'number'
       or (e ->> 'quantity')::numeric <> trunc((e ->> 'quantity')::numeric)
       or (e ->> 'quantity')::numeric not between 1 and 10
       or (e ->> 'product_id') !~ '^[0-9a-f-]{36}$'
  ) or (
    select count(distinct e ->> 'product_id') from jsonb_array_elements(p_items) e
  ) <> v_count then
    raise exception 'invalid_items';
  end if;

  v_rules := private.start_order(v_uid, p_rules_version, p_delivery_method, p_address, p_city);
  v_shipping := case when p_delivery_method = 'shipping' then v_rules.shipping_fee_cop else 0 end;

  insert into public.orders (
    customer_id, delivery_method, recipient_name, phone, address, city, customer_notes,
    rules_version, subtotal_cop, shipping_cop, total_cop, hold_expires_at
  ) values (
    v_uid, p_delivery_method, trim(p_recipient_name), trim(p_phone),
    case when p_delivery_method = 'shipping' then trim(p_address) end,
    case when p_delivery_method = 'shipping' then trim(p_city) end,
    nullif(trim(p_customer_notes), ''),
    v_rules.version, 1, v_shipping, 1 + v_shipping,
    now() + make_interval(mins => v_rules.booking_hold_minutes)
  )
  returning id into v_order_id;

  -- Se bloquean los productos en orden (evita bloqueos cruzados) y se revisa el stock.
  for v_item in
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found or not v_product.is_active then
      raise exception 'product_unavailable';
    end if;
    -- El pedido nuevo ya está insertado pero sin productos: no cuenta en lo apartado.
    if v_product.stock - private.reserved_units(v_product.id) < v_item.quantity then
      raise exception 'out_of_stock';
    end if;
    insert into public.order_items (order_id, product_id, product_name, unit_price_cop, quantity, line_total_cop)
    values (v_order_id, v_product.id, v_product.name, v_product.price_cop, v_item.quantity,
            v_product.price_cop * v_item.quantity);
    v_subtotal := v_subtotal + v_product.price_cop * v_item.quantity;
  end loop;

  v_credit := least(greatest(private.credit_balance(v_uid), 0), v_subtotal + v_shipping);
  update public.orders
  set subtotal_cop = v_subtotal, total_cop = v_subtotal + v_shipping, credit_applied_cop = v_credit
  where id = v_order_id;
  if v_credit > 0 then
    perform private.spend_order_credit(v_uid, v_credit, v_order_id);
  end if;

  -- El saldo cubrió todo: queda pagado (las unidades ya están bloqueadas y apartadas).
  if v_credit = v_subtotal + v_shipping then
    perform private.take_order_stock(v_order_id, false);
    update public.orders
    set status = 'paid', paid_at = now(), hold_expires_at = null
    where id = v_order_id;
  end if;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_preorder: reservar un producto agotado pagando el anticipo.
-- Errores: los de create_order + in_stock (hay unidades: se compra normal),
--   preorder_unavailable (ese producto no acepta preventa)
-- ---------------------------------------------------------------------------
create or replace function public.create_preorder(
  p_product_id uuid,
  p_quantity integer,
  p_delivery_method public.delivery_method,
  p_recipient_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_customer_notes text,
  p_rules_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rules public.business_rules;
  v_product public.products;
  v_subtotal integer;
  v_shipping integer;
  v_deposit integer;
  v_credit integer;
  v_order_id uuid;
begin
  if p_quantity is null or p_quantity not between 1 and 10 then
    raise exception 'invalid_items';
  end if;

  v_rules := private.start_order(v_uid, p_rules_version, p_delivery_method, p_address, p_city);

  select * into v_product from public.products where id = p_product_id for update;
  if not found or not v_product.is_active then
    raise exception 'product_unavailable';
  end if;
  if not v_product.allow_preorder then
    raise exception 'preorder_unavailable';
  end if;
  if v_product.stock - private.reserved_units(v_product.id) > 0 then
    raise exception 'in_stock';
  end if;

  v_subtotal := v_product.price_cop * p_quantity;
  v_shipping := case when p_delivery_method = 'shipping' then v_rules.shipping_fee_cop else 0 end;
  -- Anticipo redondeado hacia arriba al peso (centésimas de % para evitar decimales).
  v_deposit := ceil(v_subtotal * round(v_rules.preorder_deposit_percent * 100) / 10000.0)::integer;
  v_credit := least(greatest(private.credit_balance(v_uid), 0), v_deposit);

  insert into public.orders (
    customer_id, kind, delivery_method, recipient_name, phone, address, city, customer_notes,
    rules_version, subtotal_cop, shipping_cop, total_cop, deposit_cop, credit_applied_cop,
    status, hold_expires_at, deposit_paid_at
  ) values (
    v_uid, 'preorder', p_delivery_method, trim(p_recipient_name), trim(p_phone),
    case when p_delivery_method = 'shipping' then trim(p_address) end,
    case when p_delivery_method = 'shipping' then trim(p_city) end,
    nullif(trim(p_customer_notes), ''),
    v_rules.version, v_subtotal, v_shipping, v_subtotal + v_shipping, v_deposit, v_credit,
    -- Si el saldo a favor cubre el anticipo (o no hay anticipo), ya queda reservado.
    case when v_credit = v_deposit then 'deposit_paid'::public.order_status else 'pending_payment' end,
    case when v_credit = v_deposit then null else now() + make_interval(mins => v_rules.booking_hold_minutes) end,
    case when v_credit = v_deposit then now() end
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_price_cop, quantity, line_total_cop)
  values (v_order_id, v_product.id, v_product.name, v_product.price_cop, p_quantity, v_subtotal);

  if v_credit > 0 then
    perform private.spend_order_credit(v_uid, v_credit, v_order_id);
  end if;
  return v_order_id;
end;
$$;

revoke all on function public.create_preorder(uuid, integer, public.delivery_method, text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.create_preorder(uuid, integer, public.delivery_method, text, text, text, text, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- prepare_order_payment: referencia y monto según la etapa del pedido:
--   compra sin pagar   → total − saldo usado
--   preventa sin pagar → anticipo − saldo usado
--   preventa que llegó → saldo (total − anticipo)
-- Errores: not_found, already_paid, hold_expired, payment_in_progress
-- ---------------------------------------------------------------------------
create or replace function public.prepare_order_payment(p_order_id uuid)
returns table (reference text, amount_in_cents bigint, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_payment public.order_payments;
  v_stage public.payment_stage;
  v_amount integer;
  v_expires timestamptz;
begin
  select * into v_order from public.orders
  where id = p_order_id and customer_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_order.status = 'pending_payment' then
    v_stage := case when v_order.kind = 'preorder' then 'deposit' else 'full' end;
    v_amount := coalesce(v_order.deposit_cop, v_order.total_cop) - v_order.credit_applied_cop;
    v_expires := v_order.hold_expires_at;
  elsif v_order.status = 'awaiting_balance' then
    v_stage := 'balance';
    v_amount := v_order.total_cop - v_order.deposit_cop;
    v_expires := v_order.balance_due_at;
  elsif v_order.paid_at is not null or v_order.status = 'deposit_paid' then
    raise exception 'already_paid';
  else
    raise exception 'hold_expired';
  end if;

  if v_expires <= now() then
    raise exception 'hold_expired';
  end if;
  if exists (
    select 1 from public.order_payments p
    where p.order_id = v_order.id and p.stage = v_stage
      and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  select * into v_payment from public.order_payments p
  where p.order_id = v_order.id and p.stage = v_stage and p.status = 'pending'
    and p.provider_transaction_id is null and p.amount_in_cents = v_amount::bigint * 100
  order by p.created_at desc
  limit 1;

  if not found then
    insert into public.order_payments (order_id, reference, amount_in_cents, stage)
    values (
      v_order.id,
      'PED-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
      v_amount::bigint * 100,
      v_stage
    )
    returning * into v_payment;
  end if;

  return query select v_payment.reference, v_payment.amount_in_cents, v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_order_payment_event: según la etapa del pago.
-- Resultados: duplicate, unknown_status, unknown_reference, amount_mismatch,
--   ignored_final, paid, paid_late, already_paid, paid_out_of_stock,
--   paid_inactive, deposit_paid, deposit_paid_late, voided_after_approval,
--   declined, pending
-- ---------------------------------------------------------------------------
create or replace function public.apply_order_payment_event(
  p_source text,
  p_event_key text,
  p_reference text,
  p_transaction_id text,
  p_status text,
  p_amount_in_cents bigint,
  p_currency text,
  p_payment_method text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.payment_status;
  v_payment public.order_payments;
  v_order public.orders;
  v_result text;
  v_on_time boolean;
begin
  insert into public.payment_events (event_key, source, reference, provider_transaction_id, status)
  values (p_event_key, p_source, p_reference, p_transaction_id, p_status)
  on conflict (event_key) do nothing;
  if not found then
    return 'duplicate';
  end if;

  v_status := case upper(p_status)
    when 'APPROVED' then 'approved'
    when 'DECLINED' then 'declined'
    when 'VOIDED' then 'voided'
    when 'ERROR' then 'error'
    when 'PENDING' then 'pending'
  end;

  select * into v_payment from public.order_payments where reference = p_reference for update;

  if v_status is null then
    v_result := 'unknown_status';
  elsif not found then
    v_result := 'unknown_reference';
  elsif p_amount_in_cents is distinct from v_payment.amount_in_cents
        or p_currency is distinct from v_payment.currency then
    update public.order_payments set status = 'error' where id = v_payment.id and status <> 'approved';
    update public.orders
    set needs_review = true, review_note = 'El monto del pago no coincide con el total del pedido.'
    where id = v_payment.order_id;
    v_result := 'amount_mismatch';
  elsif v_payment.status = 'approved' and v_status <> 'voided' then
    v_result := 'ignored_final';
  elsif v_payment.status in ('declined', 'voided', 'error') and v_status = 'pending' then
    v_result := 'ignored_final';
  else
    update public.order_payments
    set status = v_status,
        provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
        payment_method = coalesce(left(p_payment_method, 40), payment_method),
        approved_at = case when v_status = 'approved' then now() else approved_at end
    where id = v_payment.id;

    select * into v_order from public.orders where id = v_payment.order_id for update;

    if v_status = 'approved' and v_payment.stage = 'deposit' then
      -- Anticipo de preventa: no aparta stock, así que un pago tardío también vale.
      if v_order.deposit_paid_at is null and v_order.status in ('pending_payment', 'expired', 'cancelled') then
        v_on_time := v_order.status = 'pending_payment' and v_order.hold_expires_at > now();
        if not v_on_time and v_order.credit_applied_cop > 0 then
          -- El saldo a favor se había devuelto al vencer: se vuelve a usar.
          perform private.lock_customer(v_order.customer_id);
          perform private.spend_order_credit(v_order.customer_id, v_order.credit_applied_cop, v_order.id);
        end if;
        update public.orders
        set status = 'deposit_paid', deposit_paid_at = now(), hold_expires_at = null, cancelled_at = null
        where id = v_order.id;
        v_result := case when v_on_time then 'deposit_paid' else 'deposit_paid_late' end;
      else
        update public.orders
        set needs_review = true, review_note = 'Llegó un segundo pago del anticipo: revisar devolución.'
        where id = v_order.id;
        v_result := 'already_paid';
      end if;
    elsif v_status = 'approved' and v_payment.stage = 'balance' then
      if v_order.status = 'awaiting_balance' then
        v_on_time := v_order.balance_due_at > now();
        -- A tiempo: sus unidades estaban apartadas. Tarde: solo si todavía hay.
        if private.take_order_stock(v_order.id, not v_on_time) then
          update public.orders
          set status = 'paid', paid_at = now(), balance_due_at = null
          where id = v_order.id;
          v_result := case when v_on_time then 'paid' else 'paid_late' end;
        else
          update public.orders
          set needs_review = true,
              review_note = 'Saldo pagado tarde y ya no hay unidades: devolver el dinero o reponer.'
          where id = v_order.id;
          v_result := 'paid_out_of_stock';
        end if;
      elsif v_order.paid_at is not null then
        update public.orders
        set needs_review = true, review_note = 'Llegó un segundo pago del saldo: revisar devolución.'
        where id = v_order.id;
        v_result := 'already_paid';
      else
        -- El plazo venció y el anticipo ya pasó a saldo a favor.
        update public.orders
        set needs_review = true,
            review_note = 'Pagó el saldo después de que el anticipo pasó a saldo a favor: revisar.'
        where id = v_order.id;
        v_result := 'paid_inactive';
      end if;
    elsif v_status = 'approved' then
      if v_order.status in ('pending_payment', 'expired', 'cancelled') and v_order.paid_at is null then
        v_on_time := v_order.status = 'pending_payment' and v_order.hold_expires_at > now();
        -- A tiempo: las unidades ya estaban apartadas. Tarde: solo si todavía hay.
        if private.take_order_stock(v_order.id, not v_on_time) then
          if not v_on_time and v_order.credit_applied_cop > 0 then
            perform private.lock_customer(v_order.customer_id);
            perform private.spend_order_credit(v_order.customer_id, v_order.credit_applied_cop, v_order.id);
          end if;
          v_result := case when v_on_time then 'paid' else 'paid_late' end;
          update public.orders
          set status = 'paid', paid_at = now(), hold_expires_at = null, cancelled_at = null
          where id = v_order.id;
        else
          update public.orders
          set status = case when status = 'pending_payment' then 'expired'::public.order_status else status end,
              hold_expires_at = null,
              needs_review = true,
              review_note = 'Pago aprobado pero ya no hay unidades suficientes: devolver el dinero o reponer.'
          where id = v_order.id;
          if v_order.status = 'pending_payment' and v_order.credit_applied_cop > 0 then
            perform private.refund_order_credit(v_order.customer_id, v_order.id);
          end if;
          v_result := 'paid_out_of_stock';
        end if;
      elsif v_order.paid_at is not null then
        update public.orders
        set needs_review = true, review_note = 'Llegó un segundo pago aprobado para este pedido: revisar devolución.'
        where id = v_order.id
          and exists (select 1 from public.order_payments p
                      where p.order_id = v_order.id and p.status = 'approved' and p.id <> v_payment.id);
        v_result := 'already_paid';
      else
        update public.orders
        set needs_review = true, review_note = 'Llegó un pago aprobado para un pedido que ya no está activo.'
        where id = v_order.id;
        v_result := 'paid_inactive';
      end if;
    elsif v_status = 'voided' and v_payment.status = 'approved' then
      update public.orders
      set needs_review = true, review_note = 'La pasarela anuló un pago que ya estaba aprobado.'
      where id = v_order.id;
      v_result := 'voided_after_approval';
    elsif v_status = 'pending' then
      -- Pago en proceso (ej.: PSE): se da un rato más.
      update public.orders
      set hold_expires_at = case when status = 'pending_payment'
                                 then greatest(hold_expires_at, now() + interval '60 minutes') else hold_expires_at end,
          balance_due_at = case when status = 'awaiting_balance'
                                then greatest(balance_due_at, now() + interval '60 minutes') else balance_due_at end
      where id = v_order.id;
      v_result := 'pending';
    else
      v_result := 'declined';
    end if;
  end if;

  update public.payment_events set result = v_result where event_key = p_event_key;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_my_order: la clienta cancela un pedido (o preventa) sin pagar.
-- Errores: not_found, not_cancellable, payment_in_progress
-- ---------------------------------------------------------------------------
create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders
  where id = p_order_id and customer_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'not_cancellable';
  end if;
  if exists (
    select 1 from public.order_payments p
    where p.order_id = v_order.id and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;
  update public.orders
  set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
  where id = v_order.id;
  if v_order.credit_applied_cop > 0 then
    perform private.lock_customer(v_order.customer_id);
    perform private.refund_order_credit(v_order.customer_id, v_order.id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_order_status: la admin (con 2FA) avanza el pedido.
--   pagado → listo (recoger) | enviado (envío) | cancelado
--   listo | enviado → entregado
--   preventa con anticipo (esperando o ya llegó) → cancelada
-- Cancelar algo pagado lo deja por revisar (la devolución se hace a mano) y
-- devuelve a sus lotes el saldo a favor que se había usado.
-- Errores: forbidden (42501), not_found, invalid_transition
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if not (
    (v_order.status = 'paid' and p_status = 'ready' and v_order.delivery_method = 'pickup')
    or (v_order.status = 'paid' and p_status = 'shipped' and v_order.delivery_method = 'shipping')
    or (v_order.status in ('ready', 'shipped') and p_status = 'delivered')
    or (v_order.status in ('paid', 'deposit_paid', 'awaiting_balance') and p_status = 'cancelled')
  ) then
    raise exception 'invalid_transition';
  end if;

  if p_status = 'cancelled' then
    if v_order.status = 'paid' then
      update public.products p
      set stock = p.stock + i.quantity
      from public.order_items i
      where i.order_id = v_order.id and p.id = i.product_id;
    end if;
    update public.orders
    set status = 'cancelled', cancelled_at = now(), needs_review = true,
        review_note = case when v_order.status = 'paid'
          then 'Pedido pagado cancelado por la admin: devolver el dinero en la pasarela.'
          else 'Preventa cancelada por la admin: devolver el anticipo en la pasarela.' end
    where id = v_order.id;
    if v_order.credit_applied_cop > 0 then
      perform private.lock_customer(v_order.customer_id);
      perform private.refund_order_credit(v_order.customer_id, v_order.id);
    end if;
  else
    update public.orders set status = p_status where id = v_order.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_preorder_arrived: la admin marca que llegó el producto de una preventa.
-- Aparta las unidades para la clienta y le da preorder_balance_days (de la
-- política que aceptó) para pagar el saldo. Si no hay saldo, queda pagada.
-- Devuelve el estado nuevo: awaiting_balance o paid.
-- Errores: forbidden (42501), not_found, invalid_transition,
--   out_of_stock (primero hay que sumar las unidades que llegaron)
-- ---------------------------------------------------------------------------
create or replace function public.mark_preorder_arrived(p_order_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item public.order_items;
  v_product public.products;
  v_days integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_order.kind <> 'preorder' or v_order.status <> 'deposit_paid' then
    raise exception 'invalid_transition';
  end if;

  select * into v_item from public.order_items where order_id = v_order.id limit 1;
  select * into v_product from public.products where id = v_item.product_id for update;
  if v_product.stock - private.reserved_units(v_product.id) < v_item.quantity then
    raise exception 'out_of_stock';
  end if;

  if v_order.total_cop = v_order.deposit_cop then
    perform private.take_order_stock(v_order.id, false);
    update public.orders set status = 'paid', paid_at = now(), arrived_at = now() where id = v_order.id;
    return 'paid';
  end if;

  select preorder_balance_days into v_days from public.business_rules where version = v_order.rules_version;
  update public.orders
  set status = 'awaiting_balance', arrived_at = now(),
      balance_due_at = now() + make_interval(days => coalesce(v_days, 7))
  where id = v_order.id;
  return 'awaiting_balance';
end;
$$;

revoke all on function public.mark_preorder_arrived(uuid) from public, anon;
grant execute on function public.mark_preorder_arrived(uuid) to authenticated;
