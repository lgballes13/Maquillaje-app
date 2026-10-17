-- ============================================================================
-- Fase 4 · Tienda: productos, pedidos, stock y pagos
-- ----------------------------------------------------------------------------
-- Toda la lógica de dinero y de stock vive aquí:
--   create_order()            aparta las unidades y calcula el total
--   prepare_order_payment()   crea el intento de pago (referencia + monto)
--   apply_order_payment_event() aplica lo que informa la pasarela
--   cancel_my_order()         la clienta cancela un pedido sin pagar
--   set_order_status()        la admin mueve el pedido (listo, enviado, entregado…)
-- El navegador solo envía qué productos y cuántas unidades; los precios, el
-- envío y el total los pone la base de datos.
--
-- Stock: products.stock son las unidades físicas. Un pedido sin pagar aparta
-- unidades mientras su tiempo para pagar no vence; al pagarse se descuentan.
-- Disponible = stock - unidades apartadas. Las filas de producto se bloquean
-- (FOR UPDATE) al apartar y al descontar, así nunca se vende de más.
-- ============================================================================

-- Tarifa de envío (fija por ahora; provisional hasta que la dueña la defina).
alter table public.business_rules
  add column shipping_fee_cop integer not null default 15000
    check (shipping_fee_cop between 0 and 1000000);

comment on column public.business_rules.shipping_fee_cop is 'Tarifa fija de envío de la tienda, en pesos.';

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 40),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  description text check (char_length(description) <= 1000),
  category_id uuid references public.product_categories (id) on delete set null,
  -- Pesos colombianos con IVA incluido (precio final que ve la clienta).
  price_cop integer not null check (price_cop between 1000 and 50000000),
  -- Unidades físicas en el estudio.
  stock integer not null default 0 check (stock between 0 and 100000),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.products is 'Productos de la tienda. No se borran (los pedidos los referencian): se desactivan.';

create index products_active_idx on public.products (is_active, sort_order, name);
create index products_category_idx on public.products (category_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Ruta dentro del bucket público "productos".
  storage_path text not null unique check (char_length(storage_path) <= 200),
  alt_text text not null check (char_length(alt_text) between 3 and 150),
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

create trigger product_categories_set_updated
before update on public.product_categories
for each row execute function private.set_updated_fields();

create trigger products_set_updated
before update on public.products
for each row execute function private.set_updated_fields();

create trigger audit_product_categories
after insert or update or delete on public.product_categories
for each row execute function private.audit_row_change('id');

create trigger audit_products
after insert or update or delete on public.products
for each row execute function private.audit_row_change('id');

create trigger audit_product_images
after insert or update or delete on public.product_images
for each row execute function private.audit_row_change('id');

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

create policy "product_categories: visitantes ven las activas"
on public.product_categories for select to anon using (is_active);
create policy "product_categories: usuarios ven las activas y el admin todas"
on public.product_categories for select to authenticated using (is_active or (select public.is_admin()));
create policy "product_categories: admin crea"
on public.product_categories for insert to authenticated with check ((select public.is_admin()));
create policy "product_categories: admin edita"
on public.product_categories for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "products: visitantes ven los activos"
on public.products for select to anon using (is_active);
create policy "products: usuarios ven los activos y el admin todos"
on public.products for select to authenticated using (is_active or (select public.is_admin()));
create policy "products: admin crea"
on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin edita"
on public.products for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_images: visitantes ven las de productos activos"
on public.product_images for select to anon
using (exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "product_images: usuarios ven las de productos activos y el admin todas"
on public.product_images for select to authenticated
using (
  (select public.is_admin())
  or exists (select 1 from public.products p where p.id = product_id and p.is_active)
);
create policy "product_images: admin crea"
on public.product_images for insert to authenticated with check ((select public.is_admin()));
create policy "product_images: admin borra"
on public.product_images for delete to authenticated using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.product_categories, public.products, public.product_images from anon;
revoke delete, truncate on public.product_categories, public.products from authenticated;
revoke update, truncate on public.product_images from authenticated;
-- La admin no edita el autor ni las fechas (los pone el trigger).
revoke update on public.products from authenticated;
grant update (name, description, category_id, price_cop, stock, is_active, sort_order)
  on public.products to authenticated;
revoke update on public.product_categories from authenticated;
grant update (name, sort_order, is_active) on public.product_categories to authenticated;

-- Bucket público para las fotos (cualquiera las ve; solo la admin las sube o borra).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "productos: admin sube fotos"
on storage.objects for insert to authenticated
with check (bucket_id = 'productos' and (select public.is_admin()));
create policy "productos: admin ve fotos"
on storage.objects for select to authenticated
using (bucket_id = 'productos' and (select public.is_admin()));
create policy "productos: admin borra fotos"
on storage.objects for delete to authenticated
using (bucket_id = 'productos' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'pending_payment',  -- unidades apartadas, esperando el pago
  'paid',             -- pagado: la admin lo prepara
  'ready',            -- listo para recoger en el estudio
  'shipped',          -- enviado
  'delivered',        -- entregado
  'cancelled',        -- cancelado (por la clienta sin pagar, o por la admin)
  'expired'           -- no se pagó a tiempo
);

create type public.delivery_method as enum ('pickup', 'shipping');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Número corto para hablar del pedido con la clienta (ej.: 1024).
  number bigint generated always as identity (start with 1001) unique,
  customer_id uuid not null references auth.users (id) on delete restrict,
  status public.order_status not null default 'pending_payment',
  delivery_method public.delivery_method not null,
  recipient_name text not null check (char_length(recipient_name) between 3 and 100),
  phone text not null check (phone ~ '^\+?[0-9 ]{7,20}$'),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 80),
  customer_notes text check (char_length(customer_notes) <= 500),
  rules_version integer not null references public.business_rules (version),
  subtotal_cop integer not null check (subtotal_cop > 0),
  shipping_cop integer not null check (shipping_cop >= 0),
  total_cop integer not null check (total_cop = subtotal_cop + shipping_cop),
  hold_expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  needs_review boolean not null default false,
  review_note text check (char_length(review_note) <= 300),
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_shipping_address check (
    delivery_method = 'pickup' or (address is not null and city is not null)
  ),
  constraint orders_hold_valid check (status <> 'pending_payment' or hold_expires_at is not null)
);

comment on table public.orders is 'Pedidos de la tienda. Solo los escriben las funciones de esta migración.';

create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  -- «Foto» del producto al comprar: si después cambia el precio, el pedido no cambia.
  product_name text not null,
  unit_price_cop integer not null check (unit_price_cop > 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total_cop integer not null check (line_total_cop = unit_price_cop * quantity),
  unique (order_id, product_id)
);

create index order_items_product_idx on public.order_items (product_id);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'wompi' check (provider in ('wompi')),
  reference text not null unique,
  amount_in_cents bigint not null check (amount_in_cents > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  status public.payment_status not null default 'pending',
  provider_transaction_id text unique,
  payment_method text check (char_length(payment_method) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create index order_payments_order_idx on public.order_payments (order_id, created_at desc);

create trigger orders_set_updated
before update on public.orders
for each row execute function private.set_updated_at_only();

create trigger order_payments_set_updated
before update on public.order_payments
for each row execute function private.set_updated_at_only();

create trigger audit_orders
after insert or update or delete on public.orders
for each row execute function private.audit_row_change('id');

create trigger audit_order_payments
after insert or update or delete on public.order_payments
for each row execute function private.audit_row_change('id');

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

create policy "orders: clienta ve los suyos"
on public.orders for select to authenticated using (customer_id = (select auth.uid()));
create policy "orders: admin ve todos"
on public.orders for select to authenticated using ((select public.is_admin()));

create policy "order_items: clienta ve los de sus pedidos"
on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy "order_items: admin ve todos"
on public.order_items for select to authenticated using ((select public.is_admin()));

create policy "order_payments: clienta ve los de sus pedidos"
on public.order_payments for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy "order_payments: admin ve todos"
on public.order_payments for select to authenticated using ((select public.is_admin()));

revoke all on public.orders, public.order_items, public.order_payments from anon;
revoke insert, update, delete, truncate on public.orders, public.order_items, public.order_payments
  from authenticated;

-- ---------------------------------------------------------------------------
-- Disponibilidad
-- ---------------------------------------------------------------------------
-- Unidades apartadas por pedidos sin pagar que todavía están a tiempo.
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
    and o.status = 'pending_payment' and o.hold_expires_at > now()
$$;

-- Disponible para la tienda (sin datos de nadie: solo el número).
create or replace function public.get_product_availability(p_product_ids uuid[])
returns table (product_id uuid, available integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, greatest(p.stock - private.reserved_units(p.id), 0)
  from public.products p
  where p.id = any (p_product_ids[1:100]) and p.is_active
$$;

revoke all on function private.reserved_units(uuid) from public;
revoke all on function public.get_product_availability(uuid[]) from public;
grant execute on function public.get_product_availability(uuid[]) to anon, authenticated;

-- Pedidos que no se pagaron a tiempo: sueltan sus unidades.
create or replace function private.expire_stale_orders()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.orders
    set status = 'expired', hold_expires_at = null
    where status = 'pending_payment' and hold_expires_at <= now()
    returning 1
  )
  select count(*)::integer from expired
$$;

revoke all on function private.expire_stale_orders() from public;

-- ---------------------------------------------------------------------------
-- create_order: la clienta pide productos.
-- p_items: [{"product_id": "...", "quantity": 2}, ...] (1 a 20 productos, 1 a 10 unidades c/u)
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
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform private.lock_customer(v_uid);

  select * into v_rules from public.business_rules order by version desc limit 1;
  if p_rules_version is distinct from v_rules.version then
    raise exception 'policy_changed';
  end if;

  -- Validar la lista: productos distintos, cantidades enteras de 1 a 10.
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

  if p_delivery_method = 'shipping' and (nullif(trim(p_address), '') is null or nullif(trim(p_city), '') is null) then
    raise exception 'invalid_delivery';
  end if;

  if exists (
    select 1 from public.orders o
    join public.order_payments p on p.order_id = o.id
    where o.customer_id = v_uid and o.status = 'pending_payment'
      and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  perform private.expire_stale_orders();

  -- Una clienta tiene un solo pedido sin pagar: el anterior se cancela y suelta sus unidades.
  update public.orders
  set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
  where customer_id = v_uid and status = 'pending_payment';

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

  update public.orders
  set subtotal_cop = v_subtotal, total_cop = v_subtotal + v_shipping
  where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, public.delivery_method, text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.create_order(jsonb, public.delivery_method, text, text, text, text, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- prepare_order_payment: referencia y monto para la pasarela.
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
begin
  select * into v_order from public.orders
  where id = p_order_id and customer_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_order.status <> 'pending_payment' and v_order.paid_at is not null then
    raise exception 'already_paid';
  end if;
  if v_order.status <> 'pending_payment' or v_order.hold_expires_at <= now() then
    raise exception 'hold_expired';
  end if;
  if exists (
    select 1 from public.order_payments p
    where p.order_id = v_order.id and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  select * into v_payment from public.order_payments p
  where p.order_id = v_order.id and p.status = 'pending' and p.provider_transaction_id is null
  order by p.created_at desc
  limit 1;

  if not found then
    insert into public.order_payments (order_id, reference, amount_in_cents)
    values (
      v_order.id,
      'PED-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
      v_order.total_cop::bigint * 100
    )
    returning * into v_payment;
  end if;

  return query select v_payment.reference, v_payment.amount_in_cents, v_order.hold_expires_at;
end;
$$;

revoke all on function public.prepare_order_payment(uuid) from public, anon;
grant execute on function public.prepare_order_payment(uuid) to authenticated;

-- Descuenta del stock las unidades de un pedido. Devuelve false si no alcanza
-- (solo puede pasar con un pago que llegó después de vencer el tiempo).
create or replace function private.take_order_stock(p_order_id uuid, p_require_available boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_product public.products;
begin
  for v_item in
    select product_id, quantity from public.order_items where order_id = p_order_id order by product_id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if p_require_available
       and v_product.stock - private.reserved_units(v_product.id) < v_item.quantity then
      return false;
    end if;
    if v_product.stock < v_item.quantity then
      return false;
    end if;
  end loop;

  update public.products p
  set stock = p.stock - i.quantity
  from public.order_items i
  where i.order_id = p_order_id and p.id = i.product_id;
  return true;
end;
$$;

revoke all on function private.take_order_stock(uuid, boolean) from public;

-- ---------------------------------------------------------------------------
-- apply_order_payment_event: igual que el de citas, para pedidos.
-- Resultados: duplicate, unknown_status, unknown_reference, amount_mismatch,
--   ignored_final, paid, paid_late, already_paid, paid_out_of_stock,
--   paid_inactive, voided_after_approval, declined, pending
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

    if v_status = 'approved' then
      if v_order.status in ('pending_payment', 'expired', 'cancelled') and v_order.paid_at is null then
        -- A tiempo: las unidades ya estaban apartadas. Tarde: solo si todavía hay.
        if private.take_order_stock(v_order.id, not (v_order.status = 'pending_payment' and v_order.hold_expires_at > now())) then
          v_result := case when v_order.status = 'pending_payment' and v_order.hold_expires_at > now()
                           then 'paid' else 'paid_late' end;
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
      -- Pago en proceso (ej.: PSE): se mantienen las unidades apartadas un rato más.
      update public.orders
      set hold_expires_at = greatest(hold_expires_at, now() + interval '60 minutes')
      where id = v_order.id and status = 'pending_payment';
      v_result := 'pending';
    else
      v_result := 'declined';
    end if;
  end if;

  update public.payment_events set result = v_result where event_key = p_event_key;
  return v_result;
end;
$$;

revoke all on function public.apply_order_payment_event(text, text, text, text, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_order_payment_event(text, text, text, text, text, bigint, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- cancel_my_order: la clienta cancela un pedido que todavía no pagó.
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
end;
$$;

revoke all on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_order_status: la admin (con 2FA) avanza el pedido.
--   pagado → listo (recoger) | enviado (envío) | cancelado
--   listo | enviado → entregado
-- Cancelar un pedido pagado devuelve las unidades al stock y lo deja por
-- revisar (la devolución del dinero se hace a mano en la pasarela).
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
    or (v_order.status = 'paid' and p_status = 'cancelled')
  ) then
    raise exception 'invalid_transition';
  end if;

  if p_status = 'cancelled' then
    update public.products p
    set stock = p.stock + i.quantity
    from public.order_items i
    where i.order_id = v_order.id and p.id = i.product_id;
    update public.orders
    set status = 'cancelled', cancelled_at = now(), needs_review = true,
        review_note = 'Pedido pagado cancelado por la admin: devolver el dinero en la pasarela.'
    where id = v_order.id;
  else
    update public.orders set status = p_status where id = v_order.id;
  end if;
end;
$$;

revoke all on function public.set_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_order_reviewed: la admin quita la marca «por revisar» cuando ya
-- resolvió el pedido (ej.: devolvió el dinero). Queda en la auditoría.
-- Errores: forbidden (42501), not_found
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_reviewed(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.orders set needs_review = false where id = p_order_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.mark_order_reviewed(uuid) from public, anon;
grant execute on function public.mark_order_reviewed(uuid) to authenticated;
