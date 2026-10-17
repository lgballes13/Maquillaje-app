-- ============================================================================
-- Fase 3 · Migración 2: ciclo de la cita y saldo a favor
-- ----------------------------------------------------------------------------
-- Reglas (se usan los valores de la versión de la política que aceptó la clienta):
--   Cancelar con >= free_cancellation_hours de anticipación → todo el anticipo
--     queda como saldo a favor.
--   Cancelar con menos → se descuenta reschedule_penalty_percent del anticipo y
--     el resto queda como saldo a favor (decisión de la dueña, 2026-10-17).
--   Cambiar de horario con >= free_cancellation_hours → sin costo.
--   No asistió → tiene reschedule_window_hours desde la hora de la cita para
--     reprogramar; se descuenta reschedule_penalty_percent y el resto se abona.
--   El saldo a favor se descuenta solo del anticipo de la siguiente reserva.
--
-- El saldo es un libro de movimientos (credit_movements): nunca se edita un
-- número, se agrega un movimiento. Saldo = suma de los movimientos.
-- ============================================================================

alter table public.appointments
  add column credit_applied_cop integer not null default 0 check (credit_applied_cop >= 0),
  add column rescheduled_from uuid references public.appointments (id) on delete restrict,
  add column attendance_marked_at timestamptz,
  add column confirmation_sent_at timestamptz,
  add column reminder_sent_at timestamptz,
  add constraint appointments_credit_le_deposit check (credit_applied_cop <= deposit_cop);

create unique index appointments_rescheduled_from_idx on public.appointments (rescheduled_from)
  where rescheduled_from is not null;

comment on column public.appointments.credit_applied_cop is
  'Parte del anticipo cubierta con saldo a favor. Se paga en la pasarela: deposit_cop - credit_applied_cop.';

-- ---------------------------------------------------------------------------
-- Libro del saldo a favor
-- ---------------------------------------------------------------------------
create type public.credit_reason as enum (
  'cancellation',        -- canceló con anticipación: todo el anticipo
  'late_cancellation',   -- canceló tarde: anticipo menos la penalidad
  'reschedule',          -- cambió de horario con anticipación
  'no_show_reschedule',  -- no asistió y reprogramó dentro del plazo
  'applied_to_booking',  -- se usó para pagar el anticipo de otra cita (negativo)
  'hold_released'        -- una reserva sin pagar venció y se devuelve lo aplicado
);

create table public.credit_movements (
  id bigint generated always as identity primary key,
  customer_id uuid not null references auth.users (id) on delete restrict,
  amount_cop integer not null check (amount_cop <> 0),
  reason public.credit_reason not null,
  appointment_id uuid references public.appointments (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

comment on table public.credit_movements is
  'Movimientos del saldo a favor (positivo = abono, negativo = uso). Solo los escriben las funciones de la cita.';

create index credit_movements_customer_idx on public.credit_movements (customer_id, created_at desc);

create trigger audit_credit_movements
after insert or update or delete on public.credit_movements
for each row execute function private.audit_row_change('id');

alter table public.credit_movements enable row level security;

create policy "credit_movements: clienta ve los suyos"
on public.credit_movements for select
to authenticated
using (customer_id = (select auth.uid()));

create policy "credit_movements: admin ve todos"
on public.credit_movements for select
to authenticated
using ((select public.is_admin()));

revoke all on public.credit_movements from anon;
revoke insert, update, delete, truncate on public.credit_movements from authenticated;

-- ---------------------------------------------------------------------------
-- Ayudantes
-- ---------------------------------------------------------------------------
create or replace function private.credit_balance(p_customer_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_cop), 0)::integer from public.credit_movements where customer_id = p_customer_id
$$;

-- Penalidad redondeada hacia arriba al peso (igual que el anticipo).
create or replace function private.penalty_cop(p_deposit integer, p_percent numeric)
returns integer
language sql
immutable
set search_path = ''
as $$ select ceil(p_deposit * p_percent / 100.0)::integer $$;

-- Evita que dos operaciones simultáneas de la misma clienta gasten el saldo dos veces.
create or replace function private.lock_customer(p_customer_id uuid)
returns void
language sql
set search_path = ''
as $$ select pg_advisory_xact_lock(hashtextextended('customer:' || p_customer_id::text, 0)) $$;

create or replace function private.add_credit(
  p_customer_id uuid,
  p_amount integer,
  p_reason public.credit_reason,
  p_appointment_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id)
  select p_customer_id, p_amount, p_reason, p_appointment_id
  where p_amount <> 0
$$;

revoke all on function private.credit_balance(uuid) from public;
revoke all on function private.add_credit(uuid, integer, public.credit_reason, uuid) from public;

-- Saldo de la clienta que tiene la sesión (para mostrarlo en pantalla).
create or replace function public.my_credit_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select private.credit_balance(auth.uid()) $$;

revoke all on function public.my_credit_balance() from public, anon;
grant execute on function public.my_credit_balance() to authenticated;

-- ---------------------------------------------------------------------------
-- Vencer reservas sin pagar: ahora también devuelve el saldo que tenían aplicado.
-- ---------------------------------------------------------------------------
create or replace function private.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.appointments
    set status = 'expired', hold_expires_at = null
    where status = 'pending_payment' and hold_expires_at <= now()
    returning id, customer_id, credit_applied_cop
  ), refunds as (
    insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id)
    select customer_id, credit_applied_cop, 'hold_released', id from expired where credit_applied_cop > 0
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- book_slot: núcleo de la reserva (lo usan create_booking y reschedule_appointment).
-- Aplica automáticamente el saldo a favor al anticipo.
-- ---------------------------------------------------------------------------
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

  -- Una clienta aparta un solo horario a la vez: si empieza otra reserva, se libera
  -- la anterior y se le devuelve el saldo que tenía aplicado.
  with released as (
    update public.appointments
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
    where customer_id = p_customer_id and status = 'pending_payment'
    returning id, credit_applied_cop
  )
  insert into public.credit_movements (customer_id, amount_cop, reason, appointment_id)
  select p_customer_id, credit_applied_cop, 'hold_released', id from released where credit_applied_cop > 0;

  -- Anticipo redondeado hacia arriba al peso; el saldo a favor cubre lo que alcance.
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

create or replace function public.create_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_rules_version integer,
  p_customer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform private.lock_customer(v_uid);
  return private.book_slot(v_uid, p_service_id, p_starts_at, p_rules_version, p_customer_notes, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- prepare_appointment_payment: ahora cobra solo lo que el saldo no cubrió.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_appointment_payment(p_appointment_id uuid)
returns table (reference text, amount_in_cents bigint, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_payment public.payments;
begin
  select * into v_appt from public.appointments
  where id = p_appointment_id and customer_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_appt.status = 'confirmed' then
    raise exception 'already_paid';
  end if;
  if v_appt.status <> 'pending_payment' or v_appt.hold_expires_at <= now() then
    raise exception 'hold_expired';
  end if;

  if exists (
    select 1 from public.payments p
    where p.appointment_id = v_appt.id and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  select * into v_payment from public.payments p
  where p.appointment_id = v_appt.id and p.status = 'pending' and p.provider_transaction_id is null
  order by p.created_at desc
  limit 1;

  if not found then
    insert into public.payments (appointment_id, reference, amount_in_cents)
    values (
      v_appt.id,
      'CITA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
      (v_appt.deposit_cop - v_appt.credit_applied_cop)::bigint * 100
    )
    returning * into v_payment;
  end if;

  return query select v_payment.reference, v_payment.amount_in_cents, v_appt.hold_expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_payment_event: igual que en la Fase 2, más el saldo en pagos tardíos.
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment_event(
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
  v_payment public.payments;
  v_appt public.appointments;
  v_result text;
begin
  -- 1. Idempotencia: si ya procesamos este evento, no hacemos nada.
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

  select * into v_payment from public.payments where reference = p_reference for update;

  if v_status is null then
    v_result := 'unknown_status';
  elsif not found then
    v_result := 'unknown_reference';
  elsif p_amount_in_cents is distinct from v_payment.amount_in_cents
        or p_currency is distinct from v_payment.currency then
    -- El monto no coincide con lo que calculamos: no se confirma nada.
    update public.payments set status = 'error' where id = v_payment.id and status <> 'approved';
    update public.appointments
    set needs_review = true, review_note = 'El monto del pago no coincide con el anticipo.'
    where id = v_payment.appointment_id;
    v_result := 'amount_mismatch';
  elsif v_payment.status = 'approved' and v_status <> 'voided' then
    -- Un pago aprobado no retrocede (eventos viejos que llegan tarde).
    v_result := 'ignored_final';
  elsif v_payment.status in ('declined', 'voided', 'error') and v_status = 'pending' then
    v_result := 'ignored_final';
  else
    update public.payments
    set status = v_status,
        provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
        payment_method = coalesce(left(p_payment_method, 40), payment_method),
        approved_at = case when v_status = 'approved' then now() else approved_at end
    where id = v_payment.id;

    select * into v_appt from public.appointments where id = v_payment.appointment_id for update;

    if v_status = 'approved' then
      if v_appt.status = 'pending_payment' then
        update public.appointments
        set status = 'confirmed', confirmed_at = now(), hold_expires_at = null
        where id = v_appt.id;
        v_result := 'confirmed';
      elsif v_appt.status = 'confirmed' then
        update public.appointments
        set needs_review = true, review_note = 'Llegó un segundo pago aprobado para esta cita: revisar devolución.'
        where id = v_appt.id
          and exists (select 1 from public.payments p
                      where p.appointment_id = v_appt.id and p.status = 'approved' and p.id <> v_payment.id);
        v_result := 'already_confirmed';
      elsif v_appt.status in ('expired', 'cancelled') then
        -- Pagó después de vencer el tiempo: si el horario sigue libre, se confirma.
        begin
          update public.appointments
          set status = 'confirmed', confirmed_at = now(), hold_expires_at = null, cancelled_at = null
          where id = v_appt.id;
          v_result := 'confirmed_late';
        exception when exclusion_violation then
          update public.appointments
          set needs_review = true,
              review_note = 'Pago aprobado después de vencer el cupo y el horario ya está ocupado: devolver el dinero o reprogramar.'
          where id = v_appt.id;
          v_result := 'paid_slot_taken';
        end;
        -- Al vencer se le devolvió el saldo aplicado; al confirmarse se vuelve a usar.
        if v_result = 'confirmed_late' and v_appt.credit_applied_cop > 0 then
          perform private.lock_customer(v_appt.customer_id);
          perform private.add_credit(v_appt.customer_id, -v_appt.credit_applied_cop, 'applied_to_booking', v_appt.id);
          if private.credit_balance(v_appt.customer_id) < 0 then
            update public.appointments
            set needs_review = true,
                review_note = 'Pago tardío confirmado, pero la clienta ya había usado el saldo a favor: revisar el saldo.'
            where id = v_appt.id;
          end if;
        end if;
      else
        update public.appointments
        set needs_review = true, review_note = 'Llegó un pago aprobado para una cita que ya no está activa.'
        where id = v_appt.id;
        v_result := 'paid_inactive';
      end if;
    elsif v_status = 'voided' and v_payment.status = 'approved' then
      update public.appointments
      set needs_review = true, review_note = 'La pasarela anuló un pago que estaba aprobado.'
      where id = v_appt.id;
      v_result := 'voided_after_approval';
    elsif v_status = 'pending' and v_appt.status = 'pending_payment' then
      -- Pago en proceso (ej.: PSE): se mantiene el horario apartado un rato más.
      update public.appointments
      set hold_expires_at = greatest(hold_expires_at, now() + interval '60 minutes')
      where id = v_appt.id;
      v_result := 'pending';
    else
      v_result := v_status::text;
    end if;
  end if;

  update public.payment_events set result = v_result where event_key = p_event_key;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_appointment: la clienta cancela. Devuelve el saldo que le queda a favor.
-- Errores: not_found, not_cancellable, already_started, payment_in_progress
-- ---------------------------------------------------------------------------
create or replace function public.cancel_appointment(p_appointment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.appointments;
  v_rules public.business_rules;
  v_credit integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform private.lock_customer(v_uid);

  select * into v_appt from public.appointments
  where id = p_appointment_id and customer_id = v_uid
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_appt.status = 'pending_payment' then
    if exists (select 1 from public.payments p
               where p.appointment_id = v_appt.id and p.status = 'pending' and p.provider_transaction_id is not null) then
      raise exception 'payment_in_progress';
    end if;
    -- Sin pagar: solo se libera el horario y se devuelve el saldo aplicado.
    update public.appointments
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
    where id = v_appt.id;
    perform private.add_credit(v_uid, v_appt.credit_applied_cop, 'hold_released', v_appt.id);
    return v_appt.credit_applied_cop;
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'not_cancellable';
  end if;
  if v_appt.starts_at <= now() then
    raise exception 'already_started';
  end if;

  -- Se aplica la política que la clienta aceptó, no la vigente hoy.
  select * into v_rules from public.business_rules where version = v_appt.rules_version;

  if v_appt.starts_at - now() >= make_interval(hours => v_rules.free_cancellation_hours) then
    v_credit := v_appt.deposit_cop;
    perform private.add_credit(v_uid, v_credit, 'cancellation', v_appt.id);
  else
    v_credit := v_appt.deposit_cop - private.penalty_cop(v_appt.deposit_cop, v_rules.reschedule_penalty_percent);
    perform private.add_credit(v_uid, v_credit, 'late_cancellation', v_appt.id);
  end if;

  update public.appointments
  set status = 'cancelled', cancelled_at = now()
  where id = v_appt.id;

  return v_credit;
end;
$$;

revoke all on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reschedule_appointment: cambia una cita por otro horario del mismo servicio.
-- Todo pasa en una sola transacción: si el horario nuevo no está libre, la
-- cita original queda intacta.
-- Errores: not_found, not_reschedulable, too_late_to_reschedule,
--   reschedule_window_closed, already_rescheduled + los de create_booking
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_rules_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.appointments;
  v_rules public.business_rules;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform private.lock_customer(v_uid);

  select * into v_appt from public.appointments
  where id = p_appointment_id and customer_id = v_uid
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_rules from public.business_rules where version = v_appt.rules_version;

  if exists (select 1 from public.appointments where rescheduled_from = v_appt.id) then
    raise exception 'already_rescheduled';
  end if;

  if v_appt.status = 'confirmed' then
    if v_appt.starts_at - now() < make_interval(hours => v_rules.free_cancellation_hours) then
      raise exception 'too_late_to_reschedule';
    end if;
    -- Libera el horario viejo antes de reservar el nuevo (podría ser uno cercano).
    update public.appointments set status = 'rescheduled', cancelled_at = now() where id = v_appt.id;
    perform private.add_credit(v_uid, v_appt.deposit_cop, 'reschedule', v_appt.id);
  elsif v_appt.status = 'no_show' then
    if now() > v_appt.starts_at + make_interval(hours => v_rules.reschedule_window_hours) then
      raise exception 'reschedule_window_closed';
    end if;
    perform private.add_credit(
      v_uid,
      v_appt.deposit_cop - private.penalty_cop(v_appt.deposit_cop, v_rules.reschedule_penalty_percent),
      'no_show_reschedule',
      v_appt.id
    );
  else
    raise exception 'not_reschedulable';
  end if;

  return private.book_slot(v_uid, v_appt.service_id, p_starts_at, p_rules_version, v_appt.customer_notes, v_appt.id);
end;
$$;

revoke all on function public.reschedule_appointment(uuid, timestamptz, integer) from public, anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_attendance: la admin (con 2FA) marca si la clienta asistió.
-- Errores: forbidden (42501), not_found, not_markable
-- ---------------------------------------------------------------------------
create or replace function public.mark_attendance(p_appointment_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_appt.status <> 'confirmed' or v_appt.starts_at > now() then
    raise exception 'not_markable';
  end if;

  update public.appointments
  set status = case when p_attended then 'completed' else 'no_show' end::public.appointment_status,
      attendance_marked_at = now()
  where id = v_appt.id;
end;
$$;

revoke all on function public.mark_attendance(uuid, boolean) from public, anon;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;
