-- ============================================================================
-- Saldo a favor con vencimiento (decisión de la dueña, 2026-10-17: 15 días).
-- ----------------------------------------------------------------------------
-- Cada abono (cancelar, cambiar de horario, reprogramar tras no asistir) es un
-- "lote" con fecha de vencimiento: created_at + credit_validity_days de la
-- política que la clienta aceptó en esa cita.
--
-- Filas de credit_movements:
--   lote      lot_id null,   expires_at con fecha, monto > 0  (el abono)
--   hijo      lot_id = lote, expires_at null                  (uso, devolución o vencimiento)
--   deuda     lot_id null,   expires_at null,      monto < 0  (pago tardío sin saldo; caso raro, queda por revisar)
--
-- Saldo = lo que queda de los lotes NO vencidos + deudas. Así el saldo es
-- correcto aunque la tarea diaria todavía no haya escrito el movimiento
-- «vencido». El saldo se usa empezando por el lote que vence primero, y si se
-- devuelve (reserva sin pagar) vuelve a su lote con la fecha original.
-- ============================================================================

alter table public.business_rules
  add column credit_validity_days integer not null default 15
    check (credit_validity_days between 1 and 365);

comment on column public.business_rules.credit_validity_days is
  'Días que dura un saldo a favor desde que se genera.';

alter table public.credit_movements
  add column lot_id bigint references public.credit_movements (id) on delete restrict,
  add column expires_at timestamptz;

comment on column public.credit_movements.lot_id is
  'Abono (lote) al que pertenece este uso, devolución o vencimiento. Null en los abonos y en las deudas.';
comment on column public.credit_movements.expires_at is
  'Solo en los abonos: cuándo vence lo que quede de ese abono.';

-- Movimientos anteriores a esta migración (solo hay datos de desarrollo y
-- pruebas; producción aún no tiene tablas): los positivos pasan a ser lotes y
-- los negativos se asignan al primer lote de la clienta, o quedan como deuda.
update public.credit_movements
set expires_at = created_at + interval '15 days'
where amount_cop > 0;

update public.credit_movements m
set lot_id = (
  select l.id from public.credit_movements l
  where l.customer_id = m.customer_id and l.amount_cop > 0
  order by l.created_at, l.id
  limit 1
)
where m.amount_cop < 0;

alter table public.credit_movements
  add constraint credit_movements_shape check (
    (lot_id is null and expires_at is not null and amount_cop > 0)   -- lote
    or (lot_id is not null and expires_at is null)                   -- hijo
    or (lot_id is null and expires_at is null and amount_cop < 0)    -- deuda
  );

create index credit_movements_lot_idx on public.credit_movements (lot_id) where lot_id is not null;

-- ---------------------------------------------------------------------------
-- Lotes con lo que les queda (vigentes y vencidos).
-- ---------------------------------------------------------------------------
create or replace function private.credit_lots(p_customer_id uuid)
returns table (lot_id bigint, remaining_cop integer, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id,
         (l.amount_cop + coalesce((select sum(c.amount_cop) from public.credit_movements c where c.lot_id = l.id), 0))::integer,
         l.expires_at
  from public.credit_movements l
  where l.customer_id = p_customer_id and l.lot_id is null and l.expires_at is not null
$$;

create or replace function private.credit_balance(p_customer_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(remaining_cop) from private.credit_lots(p_customer_id) where expires_at > now()), 0)
    + coalesce((select sum(amount_cop) from public.credit_movements
                where customer_id = p_customer_id and lot_id is null and expires_at is null), 0)
  )::integer
$$;

-- Usa saldo empezando por el lote que vence primero. Lo que no alcance (solo
-- pasa con pagos tardíos) queda como deuda para revisar.
create or replace function private.spend_credit(p_customer_id uuid, p_amount integer, p_appointment_id uuid)
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
    insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id, lot_id)
    values (p_customer_id, -v_take, 'applied_to_booking', p_appointment_id, v_lot.lot_id);
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id)
    values (p_customer_id, -v_left, 'applied_to_booking', p_appointment_id);
  end if;
end;
$$;

-- Devuelve el saldo que tenía aplicado una reserva sin pagar, a los mismos
-- lotes (conservan su fecha de vencimiento). Devuelve el total devuelto.
create or replace function private.refund_credit(p_customer_id uuid, p_appointment_id uuid)
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
    where appointment_id = p_appointment_id and customer_id = p_customer_id and lot_id is not null
    group by lot_id
    having sum(amount_cop) < 0
  ), inserted as (
    insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id, lot_id)
    select p_customer_id, amount, 'hold_released', p_appointment_id, lot_id from net
    returning amount_cop
  )
  select coalesce(sum(amount_cop), 0)::integer into v_total from inserted;
  return v_total;
end;
$$;

-- Punto único para mover el saldo (lo usan todas las funciones de la cita):
--   monto < 0                → usar saldo (FIFO)
--   motivo 'hold_released'   → devolver lo aplicado a esa cita
--   monto > 0                → abono nuevo que vence según la política de la cita
create or replace function private.add_credit(
  p_customer_id uuid,
  p_amount integer,
  p_reason public.credit_reason,
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
begin
  if p_amount = 0 then
    return;
  end if;
  perform private.lock_customer(p_customer_id);

  if p_amount < 0 then
    perform private.spend_credit(p_customer_id, -p_amount, p_appointment_id);
  elsif p_reason = 'hold_released' then
    perform private.refund_credit(p_customer_id, p_appointment_id);
  else
    select r.credit_validity_days into v_days
    from public.appointments a
    join public.business_rules r on r.version = a.rules_version
    where a.id = p_appointment_id;
    if v_days is null then
      select credit_validity_days into v_days from public.business_rules order by version desc limit 1;
    end if;
    insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id, expires_at)
    values (p_customer_id, p_amount, p_reason, p_appointment_id, now() + make_interval(days => v_days));
  end if;
end;
$$;

-- Escribe el movimiento «vencido» de los lotes que ya vencieron y aún tenían saldo.
-- Con p_customer_id null revisa a todas las clientas (tarea diaria).
create or replace function private.expire_credits(p_customer_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_count integer := 0;
  v_rows integer;
begin
  for v_customer in
    select distinct customer_id from public.credit_movements
    where lot_id is null and expires_at <= now()
      and (p_customer_id is null or customer_id = p_customer_id)
  loop
    perform private.lock_customer(v_customer);
    insert into public.credit_movements (customer_id, amount_cop, reason, lot_id)
    select v_customer, -remaining_cop, 'expired', lot_id
    from private.credit_lots(v_customer)
    where expires_at <= now() and remaining_cop > 0;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.credit_lots(uuid) from public;
revoke all on function private.spend_credit(uuid, integer, uuid) from public;
revoke all on function private.refund_credit(uuid, uuid) from public;
revoke all on function private.expire_credits(uuid) from public;

-- Tarea diaria (solo servidor, con la llave service_role).
create or replace function public.expire_credits()
returns integer
language sql
security definer
set search_path = ''
as $$ select private.expire_credits(null) $$;

revoke all on function public.expire_credits() from public, anon, authenticated;
grant execute on function public.expire_credits() to service_role;

-- Saldo vigente de la clienta con sesión, por lote, para mostrar cuándo vence.
create or replace function public.my_credit_lots()
returns table (remaining_cop integer, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select remaining_cop, expires_at from private.credit_lots(auth.uid())
  where expires_at > now() and remaining_cop > 0
  order by expires_at
$$;

revoke all on function public.my_credit_lots() from public, anon;
grant execute on function public.my_credit_lots() to authenticated;

-- ---------------------------------------------------------------------------
-- Las dos funciones que escribían el saldo directo ahora pasan por add_credit.
-- ---------------------------------------------------------------------------
create or replace function private.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt record;
  v_count integer := 0;
begin
  for v_appt in
    update public.appointments
    set status = 'expired', hold_expires_at = null
    where status = 'pending_payment' and hold_expires_at <= now()
    returning id, customer_id, credit_applied_cop
  loop
    perform private.add_credit(v_appt.customer_id, v_appt.credit_applied_cop, 'hold_released', v_appt.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function private.book_slot(
  p_customer_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_rules_version integer,
  p_customer_notes text,
  p_rescheduled_from uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules public.business_rules;
  v_service public.services;
  v_hours public.business_hours;
  v_tz text := private.business_time_zone();
  v_ends_at timestamptz;
  v_blocked_until timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_deposit integer;
  v_credit integer;
  v_released record;
  v_id uuid;
begin
  select * into v_rules from public.business_rules order by version desc limit 1;
  -- La clienta aceptó una versión de la política; si cambió mientras tanto, debe verla de nuevo.
  if p_rules_version is distinct from v_rules.version then
    raise exception 'policy_changed';
  end if;

  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'service_unavailable';
  end if;

  if p_starts_at is null or p_starts_at <> date_trunc('minute', p_starts_at)
     or extract(minute from p_starts_at)::integer % 5 <> 0 then
    raise exception 'invalid_start';
  end if;

  if p_starts_at < now() + make_interval(hours => v_rules.min_booking_notice_hours)
     or p_starts_at > now() + make_interval(days => v_rules.max_booking_days_ahead) then
    raise exception 'outside_booking_window';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_blocked_until := v_ends_at + make_interval(mins => v_rules.buffer_minutes);
  v_local_start := p_starts_at at time zone v_tz;
  v_local_end := v_ends_at at time zone v_tz;

  select * into v_hours from public.business_hours
  where weekday = extract(dow from v_local_start)::smallint;
  if not v_hours.is_open
     or v_local_end::date <> v_local_start::date
     or v_local_start::time < v_hours.opens_at
     or v_local_end::time > v_hours.closes_at then
    raise exception 'outside_business_hours';
  end if;

  if exists (
    select 1 from public.blocked_periods b
    where tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, v_blocked_until, '[)')
  ) then
    raise exception 'slot_unavailable';
  end if;

  -- Si la clienta tiene un pago en proceso (ej.: PSE pendiente), no puede apartar otro horario.
  if exists (
    select 1 from public.appointments a
    join public.payments p on p.appointment_id = a.id
    where a.customer_id = p_customer_id and a.status = 'pending_payment'
      and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  perform private.expire_stale_holds();
  perform private.expire_credits(p_customer_id);

  -- Una clienta aparta un solo horario a la vez: si empieza otra reserva, se libera
  -- la anterior y se le devuelve el saldo que tenía aplicado.
  for v_released in
    update public.appointments
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
    where customer_id = p_customer_id and status = 'pending_payment'
    returning id, credit_applied_cop
  loop
    perform private.add_credit(p_customer_id, v_released.credit_applied_cop, 'hold_released', v_released.id);
  end loop;

  -- Anticipo redondeado hacia arriba al peso; el saldo vigente cubre lo que alcance.
  v_deposit := ceil(v_service.price_cop * v_rules.deposit_percent / 100.0)::integer;
  v_credit := least(greatest(private.credit_balance(p_customer_id), 0), v_deposit);

  begin
    insert into public.appointments (
      customer_id, service_id, service_name, duration_minutes, price_cop,
      rules_version, deposit_percent, deposit_cop, credit_applied_cop, policy_accepted_at,
      starts_at, ends_at, blocked_until, status, hold_expires_at, confirmed_at,
      customer_notes, rescheduled_from
    ) values (
      p_customer_id, v_service.id, v_service.name, v_service.duration_minutes, v_service.price_cop,
      v_rules.version, v_rules.deposit_percent, v_deposit, v_credit, now(),
      p_starts_at, v_ends_at, v_blocked_until,
      case when v_deposit = v_credit then 'confirmed' else 'pending_payment' end::public.appointment_status,
      case when v_deposit = v_credit then null else now() + make_interval(mins => v_rules.booking_hold_minutes) end,
      case when v_deposit = v_credit then now() end,
      nullif(trim(p_customer_notes), ''),
      p_rescheduled_from
    )
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;

  perform private.add_credit(p_customer_id, -v_credit, 'applied_to_booking', v_id);
  return v_id;
end;
$$;

revoke all on function private.book_slot(uuid, uuid, timestamptz, integer, text, uuid) from public;
