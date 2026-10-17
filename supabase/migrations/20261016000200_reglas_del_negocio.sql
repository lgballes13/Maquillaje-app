-- ============================================================================
-- Fase 1 · Migración 2: reglas del negocio y horario de atención
-- ----------------------------------------------------------------------------
-- Las reglas (porcentajes, plazos) se guardan como VERSIONES que nunca se
-- modifican: cambiar una regla = crear una versión nueva. Así cada cita podrá
-- guardar qué versión de la política aceptó el cliente (Fase 2).
-- ============================================================================

create table public.business_rules (
  version integer generated always as identity primary key,

  -- Anticipo para reservar una cita (% del valor del servicio)
  deposit_percent numeric(5, 2) not null check (deposit_percent between 0 and 100),
  -- Horas que tiene el cliente, después de no asistir, para reprogramar
  -- y conservar parte del anticipo (interpretación pendiente de confirmar)
  reschedule_window_hours integer not null check (reschedule_window_hours between 1 and 720),
  -- % del anticipo que se pierde al reprogramar dentro de ese plazo
  reschedule_penalty_percent numeric(5, 2) not null check (reschedule_penalty_percent between 0 and 100),
  -- Cancelar con al menos estas horas de anticipación no tiene penalidad
  free_cancellation_hours integer not null check (free_cancellation_hours between 0 and 720),
  -- Preventa: % de anticipo y días estimados de entrega
  preorder_deposit_percent numeric(5, 2) not null check (preorder_deposit_percent between 0 and 100),
  preorder_delivery_days integer not null check (preorder_delivery_days between 1 and 365),
  -- Minutos de preparación entre una cita y la siguiente
  buffer_minutes integer not null check (buffer_minutes between 0 and 240),
  -- Minutos que se aparta un horario mientras el cliente paga
  booking_hold_minutes integer not null check (booking_hold_minutes between 5 and 30),
  -- Anticipación mínima para reservar y máximo de días hacia adelante
  min_booking_notice_hours integer not null check (min_booking_notice_hours between 0 and 720),
  max_booking_days_ahead integer not null check (max_booking_days_ahead between 1 and 365),

  change_reason text check (char_length(change_reason) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.business_rules is
  'Historial de versiones de las reglas del negocio. La vigente es la de mayor versión. Nunca se editan ni se borran.';

-- Versión inicial con valores PROVISIONALES (el admin los cambia desde el panel).
insert into public.business_rules (
  deposit_percent, reschedule_window_hours, reschedule_penalty_percent, free_cancellation_hours,
  preorder_deposit_percent, preorder_delivery_days, buffer_minutes, booking_hold_minutes,
  min_booking_notice_hours, max_booking_days_ahead, change_reason
) values (50, 24, 30, 48, 50, 15, 15, 10, 12, 90, 'Valores iniciales provisionales');

-- ---------------------------------------------------------------------------
-- Horario de atención por día de la semana
-- weekday: 0 = domingo, 1 = lunes … 6 = sábado (igual que JavaScript y Postgres)
-- ---------------------------------------------------------------------------
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null,
  opens_at time,
  closes_at time,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint business_hours_valid check (
    (not is_open and opens_at is null and closes_at is null)
    or (is_open and opens_at is not null and closes_at is not null and opens_at < closes_at)
  )
);

comment on table public.business_hours is 'Horario general de atención. La Fase 2 agrega horarios por maquilladora.';

-- Horario provisional: lunes a sábado 9:00–19:00, domingo cerrado.
insert into public.business_hours (weekday, is_open, opens_at, closes_at) values
  (0, false, null, null),
  (1, true, '09:00', '19:00'),
  (2, true, '09:00', '19:00'),
  (3, true, '09:00', '19:00'),
  (4, true, '09:00', '19:00'),
  (5, true, '09:00', '19:00'),
  (6, true, '09:00', '19:00');

create or replace function private.set_updated_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger business_hours_set_updated
before update on public.business_hours
for each row execute function private.set_updated_fields();

-- ---------------------------------------------------------------------------
-- RLS
-- Las reglas y el horario son públicos (el cliente debe verlos antes de pagar),
-- pero solo el admin con 2FA puede cambiarlos.
-- ---------------------------------------------------------------------------
alter table public.business_rules enable row level security;
alter table public.business_hours enable row level security;

create policy "business_rules: lectura pública"
on public.business_rules for select
to anon, authenticated
using (true);

create policy "business_rules: admin crea versiones"
on public.business_rules for insert
to authenticated
with check ((select public.is_admin()));

-- Las versiones son inmutables: nadie puede editarlas ni borrarlas.
revoke update, delete, truncate on public.business_rules from anon, authenticated;
revoke insert on public.business_rules from anon;

create policy "business_hours: lectura pública"
on public.business_hours for select
to anon, authenticated
using (true);

create policy "business_hours: admin edita"
on public.business_hours for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Siempre hay exactamente 7 días: no se insertan ni se borran filas.
revoke insert, delete, truncate on public.business_hours from anon, authenticated;
revoke update on public.business_hours from anon;
-- El admin solo puede cambiar estas columnas (updated_* las pone el trigger).
revoke update on public.business_hours from authenticated;
grant update (is_open, opens_at, closes_at) on public.business_hours to authenticated;
