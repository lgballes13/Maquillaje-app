-- ============================================================================
-- Fase 2 · Migración 1: servicios y bloqueos de agenda
-- ----------------------------------------------------------------------------
-- services: lo que se puede agendar (nombre, duración, precio en pesos).
--   Nunca se borra un servicio (las citas viejas lo referencian): se desactiva.
-- blocked_periods: fechas u horas en que no se atiende (vacaciones, eventos).
-- ============================================================================

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  description text check (char_length(description) <= 500),
  duration_minutes integer not null check (duration_minutes between 15 and 600),
  -- Pesos colombianos sin decimales (COP no usa centavos en la práctica).
  price_cop integer not null check (price_cop between 1000 and 50000000),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.services is 'Servicios que se pueden agendar. No se borran: se desactivan.';

create index services_active_order_idx on public.services (is_active, sort_order, name);

create trigger services_set_updated
before update on public.services
for each row execute function private.set_updated_fields();

create trigger audit_services
after insert or update or delete on public.services
for each row execute function private.audit_row_change('id');

-- ---------------------------------------------------------------------------
create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Nota interna para el admin; la clienta nunca la ve.
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  constraint blocked_periods_valid check (
    starts_at < ends_at and ends_at - starts_at <= interval '90 days'
  )
);

comment on table public.blocked_periods is 'Periodos sin atención. Privado: la clienta solo ve que el horario no está libre.';

create index blocked_periods_range_idx on public.blocked_periods using gist (tstzrange(starts_at, ends_at, '[)'));

create trigger audit_blocked_periods
after insert or update or delete on public.blocked_periods
for each row execute function private.audit_row_change('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.services enable row level security;
alter table public.blocked_periods enable row level security;

create policy "services: visitantes ven los activos"
on public.services for select
to anon
using (is_active);

create policy "services: usuarios ven los activos y el admin todos"
on public.services for select
to authenticated
using (is_active or (select public.is_admin()));

create policy "services: admin crea"
on public.services for insert
to authenticated
with check ((select public.is_admin()));

create policy "services: admin edita"
on public.services for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke insert, update, delete, truncate on public.services from anon;
revoke delete, truncate on public.services from authenticated;
revoke insert, update on public.services from authenticated;
grant insert (name, description, duration_minutes, price_cop, is_active, sort_order)
  on public.services to authenticated;
grant update (name, description, duration_minutes, price_cop, is_active, sort_order)
  on public.services to authenticated;

create policy "blocked_periods: admin lee"
on public.blocked_periods for select
to authenticated
using ((select public.is_admin()));

create policy "blocked_periods: admin crea"
on public.blocked_periods for insert
to authenticated
with check ((select public.is_admin()));

create policy "blocked_periods: admin borra"
on public.blocked_periods for delete
to authenticated
using ((select public.is_admin()));

revoke all on public.blocked_periods from anon;
revoke update, truncate on public.blocked_periods from authenticated;
revoke insert on public.blocked_periods from authenticated;
grant insert (starts_at, ends_at, reason) on public.blocked_periods to authenticated;

-- Servicios de ejemplo (PROVISIONALES: el admin los edita o desactiva).
insert into public.services (name, description, duration_minutes, price_cop, sort_order) values
  ('Maquillaje social', 'Para fiestas, grados y eventos. Incluye pestañas.', 90, 180000, 1),
  ('Maquillaje de novia', 'Incluye prueba de piel y fijación de larga duración.', 150, 450000, 2),
  ('Asesoría de automaquillaje', 'Clase personalizada con tus propios productos.', 120, 220000, 3);
