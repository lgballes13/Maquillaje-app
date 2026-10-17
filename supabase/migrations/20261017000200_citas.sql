-- ============================================================================
-- Fase 2 · Migración 2: citas
-- ----------------------------------------------------------------------------
-- Una cita guarda una "foto" del servicio y de la política que aceptó la
-- clienta (precio, duración, % de anticipo, versión de reglas). Si mañana
-- cambian los precios o las reglas, la cita conserva lo que se pactó.
--
-- Anti-solapamiento: una restricción EXCLUDE de Postgres impide que dos citas
-- activas ocupen el mismo tiempo, incluso si dos personas reservan en el mismo
-- milisegundo. No depende del código de la app: lo garantiza la base de datos.
-- ============================================================================

create type public.appointment_status as enum (
  'pending_payment', -- horario apartado mientras la clienta paga (hold)
  'confirmed',       -- anticipo pagado (o política sin anticipo)
  'expired',         -- no pagó a tiempo; el horario se liberó
  'cancelled'        -- cancelada (la clienta empezó otra reserva, o en la Fase 3)
);

-- Zona horaria del negocio. Debe coincidir con siteConfig.timeZone en la app.
create or replace function private.business_time_zone()
returns text
language sql
immutable
set search_path = ''
as $$ select 'America/Bogota' $$;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,

  -- Foto del servicio al momento de reservar
  service_name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cop integer not null check (price_cop > 0),

  -- Foto de la política aceptada
  rules_version integer not null references public.business_rules (version),
  deposit_percent numeric(5, 2) not null check (deposit_percent between 0 and 100),
  deposit_cop integer not null check (deposit_cop >= 0),
  policy_accepted_at timestamptz not null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Fin de la cita + minutos de preparación: hasta aquí el horario está ocupado.
  blocked_until timestamptz not null,
  period tstzrange generated always as (tstzrange(starts_at, blocked_until, '[)')) stored,

  status public.appointment_status not null default 'pending_payment',
  hold_expires_at timestamptz,
  customer_notes text check (char_length(customer_notes) <= 500),

  -- Casos que el admin debe revisar a mano (ej.: pago aprobado tarde).
  needs_review boolean not null default false,
  review_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,

  constraint appointments_times_valid check (starts_at < ends_at and ends_at <= blocked_until),
  constraint appointments_hold_valid check (status <> 'pending_payment' or hold_expires_at is not null),
  constraint appointments_no_overlap exclude using gist (period with &&)
    where (status in ('pending_payment', 'confirmed'))
);

comment on table public.appointments is
  'Citas. Se crean solo con public.create_booking(); la restricción appointments_no_overlap impide cruces.';

create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_pending_idx on public.appointments (hold_expires_at)
  where status = 'pending_payment';

create or replace function private.set_updated_at_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_set_updated
before update on public.appointments
for each row execute function private.set_updated_at_only();

create trigger audit_appointments
after insert or update or delete on public.appointments
for each row execute function private.audit_row_change('id');

-- ---------------------------------------------------------------------------
-- Libera los horarios apartados cuyo tiempo para pagar ya venció.
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
  update public.appointments
  set status = 'expired', hold_expires_at = null
  where status = 'pending_payment' and hold_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Horarios ocupados en un rango (citas activas + bloqueos), SIN datos de
-- nadie: solo inicio y fin. Lo usa la página de agendar para calcular los
-- horarios libres.
-- ---------------------------------------------------------------------------
create or replace function public.get_busy_periods(p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '31 days' then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return query
    select a.starts_at, a.blocked_until
    from public.appointments a
    where a.period && tstzrange(p_from, p_to, '[)')
      and (a.status = 'confirmed' or (a.status = 'pending_payment' and a.hold_expires_at > now()))
    union all
    select b.starts_at, b.ends_at
    from public.blocked_periods b
    where tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_from, p_to, '[)')
    order by 1;
end;
$$;

revoke all on function public.get_busy_periods(timestamptz, timestamptz) from public;
grant execute on function public.get_busy_periods(timestamptz, timestamptz) to anon, authenticated;
revoke all on function private.expire_stale_holds() from public;

-- ---------------------------------------------------------------------------
-- RLS: la clienta ve sus citas; el admin con 2FA ve todas.
-- Nadie escribe directo en la tabla: solo por las funciones de reserva y pago.
-- ---------------------------------------------------------------------------
alter table public.appointments enable row level security;

create policy "appointments: clienta ve las suyas"
on public.appointments for select
to authenticated
using (customer_id = (select auth.uid()));

create policy "appointments: admin ve todas"
on public.appointments for select
to authenticated
using ((select public.is_admin()));

revoke all on public.appointments from anon;
revoke insert, update, delete, truncate on public.appointments from authenticated;
