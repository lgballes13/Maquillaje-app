-- ============================================================================
-- Fase 2 · Migración 3: reservas y pagos
-- ----------------------------------------------------------------------------
-- Toda la lógica de dinero vive aquí, en el servidor de base de datos:
--   create_booking()               aparta el horario y calcula el anticipo
--   prepare_appointment_payment()  crea el intento de pago (referencia + monto)
--   apply_payment_event()          aplica lo que informa la pasarela (webhook)
-- El navegador nunca envía montos: solo el servicio y la hora elegidos.
-- ============================================================================

create type public.payment_status as enum ('pending', 'approved', 'declined', 'voided', 'error');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  provider text not null default 'wompi' check (provider in ('wompi')),
  -- Referencia única que enviamos a la pasarela y que vuelve en el webhook.
  reference text not null unique,
  amount_in_cents bigint not null check (amount_in_cents > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  status public.payment_status not null default 'pending',
  provider_transaction_id text unique,
  -- Tipo de medio (CARD, PSE, NEQUI…). Nunca se guardan datos de la tarjeta.
  payment_method text check (char_length(payment_method) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

comment on table public.payments is 'Intentos de pago. Solo los escribe el servidor (funciones de esta migración).';

create index payments_appointment_idx on public.payments (appointment_id, created_at desc);

create trigger payments_set_updated
before update on public.payments
for each row execute function private.set_updated_at_only();

create trigger audit_payments
after insert or update or delete on public.payments
for each row execute function private.audit_row_change('id');

-- Cada evento recibido se guarda una sola vez (idempotencia): si la pasarela
-- reenvía el mismo evento, se reconoce y no se aplica dos veces.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null default 'wompi',
  event_key text not null unique,
  source text not null check (source in ('webhook', 'api')),
  reference text,
  provider_transaction_id text,
  status text,
  result text,
  received_at timestamptz not null default now()
);

comment on table public.payment_events is 'Eventos de la pasarela ya procesados (sin datos personales).';

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

create policy "payments: clienta ve los de sus citas"
on public.payments for select
to authenticated
using (exists (
  select 1 from public.appointments a
  where a.id = appointment_id and a.customer_id = (select auth.uid())
));

create policy "payments: admin ve todos"
on public.payments for select
to authenticated
using ((select public.is_admin()));

create policy "payment_events: admin lee"
on public.payment_events for select
to authenticated
using ((select public.is_admin()));

revoke all on public.payments from anon;
revoke insert, update, delete, truncate on public.payments from authenticated;
revoke all on public.payment_events from anon;
revoke insert, update, delete, truncate on public.payment_events from authenticated;

-- ---------------------------------------------------------------------------
-- create_booking: la clienta aparta un horario.
-- Errores (el mensaje es un código que la app traduce al español):
--   not_authenticated, policy_changed, service_unavailable, invalid_start,
--   outside_booking_window, outside_business_hours, slot_unavailable,
--   payment_in_progress
-- ---------------------------------------------------------------------------
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
  v_rules public.business_rules;
  v_service public.services;
  v_hours public.business_hours;
  v_tz text := private.business_time_zone();
  v_ends_at timestamptz;
  v_blocked_until timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_deposit integer;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

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
    where a.customer_id = v_uid and a.status = 'pending_payment'
      and p.status = 'pending' and p.provider_transaction_id is not null
  ) then
    raise exception 'payment_in_progress';
  end if;

  perform private.expire_stale_holds();

  -- Una clienta aparta un solo horario a la vez: si empieza otra reserva, se libera la anterior.
  update public.appointments
  set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
  where customer_id = v_uid and status = 'pending_payment';

  -- Anticipo redondeado hacia arriba al peso.
  v_deposit := ceil(v_service.price_cop * v_rules.deposit_percent / 100.0)::integer;

  begin
    insert into public.appointments (
      customer_id, service_id, service_name, duration_minutes, price_cop,
      rules_version, deposit_percent, deposit_cop, policy_accepted_at,
      starts_at, ends_at, blocked_until, status, hold_expires_at, confirmed_at, customer_notes
    ) values (
      v_uid, v_service.id, v_service.name, v_service.duration_minutes, v_service.price_cop,
      v_rules.version, v_rules.deposit_percent, v_deposit, now(),
      p_starts_at, v_ends_at, v_blocked_until,
      case when v_deposit = 0 then 'confirmed' else 'pending_payment' end::public.appointment_status,
      case when v_deposit = 0 then null else now() + make_interval(mins => v_rules.booking_hold_minutes) end,
      case when v_deposit = 0 then now() end,
      nullif(trim(p_customer_notes), '')
    )
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;

  return v_id;
end;
$$;

revoke all on function public.create_booking(uuid, timestamptz, integer, text) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- prepare_appointment_payment: devuelve la referencia y el monto que se
-- envían a la pasarela. Reutiliza el intento sin usar para no cobrar dos veces.
-- Errores: not_found, hold_expired, already_paid, payment_in_progress
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
      v_appt.deposit_cop::bigint * 100
    )
    returning * into v_payment;
  end if;

  return query select v_payment.reference, v_payment.amount_in_cents, v_appt.hold_expires_at;
end;
$$;

revoke all on function public.prepare_appointment_payment(uuid) from public, anon;
grant execute on function public.prepare_appointment_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- apply_payment_event: aplica una actualización de la pasarela. Solo la llama
-- el servidor (service_role) DESPUÉS de verificar la firma del evento.
-- Devuelve un código de resultado (para el registro), nunca lanza por datos
-- de negocio: así la pasarela no reintenta eventos que nunca van a cambiar.
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
      else
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

revoke all on function public.apply_payment_event(text, text, text, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, text, text, bigint, text, text) to service_role;
