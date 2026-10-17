-- ============================================================================
-- Fase 1 · Migración 1: perfiles de usuario y roles
-- ----------------------------------------------------------------------------
-- Cada persona que se registra tiene una fila en auth.users (la maneja Supabase)
-- y una fila en public.profiles con sus datos. Los roles (admin, maquilladora)
-- viven en public.user_roles. Quien no tiene rol es un cliente normal.
-- ============================================================================

-- Esquema privado: funciones internas que la API pública NO expone.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Función reutilizable: actualiza la columna updated_at en cada UPDATE.
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles. 'artist' (maquilladora) queda listo para cuando haya varias agendas.
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'artist');

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  -- Teléfono en formato internacional, ej.: +573001234567 (opcional)
  phone text check (phone ~ '^\+[0-9]{8,15}$'),
  -- Ley 1581: guardamos qué versión de la política aceptó y cuándo.
  privacy_policy_version text not null check (char_length(privacy_policy_version) between 1 and 20),
  privacy_accepted_at timestamptz not null,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos de cada usuario. Se crea automáticamente al registrarse.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles por usuario
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  primary key (user_id, role)
);

comment on table public.user_roles is 'Roles especiales. Un usuario sin filas aquí es un cliente.';

-- ---------------------------------------------------------------------------
-- Funciones de permisos (las usan las políticas RLS)
-- security definer: se ejecutan con permisos del dueño para poder leer
-- user_roles sin caer en un ciclo de RLS. search_path vacío evita que alguien
-- "suplante" tablas creando objetos con el mismo nombre.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
  );
$$;

-- Admin "completo": tiene el rol Y inició sesión con segundo factor (aal2).
-- Así, aunque alguien robe la contraseña del admin, la base de datos no le
-- deja cambiar nada sin el código del autenticador.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin')
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Crear el perfil automáticamente al registrarse.
-- Exige la autorización de tratamiento de datos (Ley 1581) aunque alguien
-- intente registrarse llamando a Supabase directamente, sin nuestro formulario.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := btrim(v_meta ->> 'full_name');
  v_phone text := nullif(btrim(v_meta ->> 'phone'), '');
  v_policy_version text := nullif(btrim(v_meta ->> 'privacy_policy_version'), '');
  v_accepted boolean := coalesce((v_meta ->> 'privacy_accepted')::boolean, false);
begin
  if not v_accepted or v_policy_version is null then
    raise exception 'Se requiere la autorización de tratamiento de datos personales'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, full_name, phone, privacy_policy_version, privacy_accepted_at, marketing_opt_in)
  values (
    new.id,
    v_full_name,
    v_phone,
    v_policy_version,
    now(), -- hora del servidor: no confiamos en una fecha enviada por el cliente
    coalesce((v_meta ->> 'marketing_opt_in')::boolean, false)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Los visitantes sin sesión (anon) no tocan estas tablas.
revoke all on public.profiles from anon;
revoke all on public.user_roles from anon;

-- Perfiles: cada quien ve el suyo; el admin (con 2FA) ve todos.
create policy "profiles: ver el propio o admin"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

-- Perfiles: cada quien edita el suyo, pero solo estas columnas.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;

create policy "profiles: editar el propio"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Roles: cada quien ve sus roles; solo el admin con 2FA los asigna o quita.
create policy "user_roles: ver los propios o admin"
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "user_roles: admin inserta"
on public.user_roles for insert
to authenticated
with check ((select public.is_admin()));

create policy "user_roles: admin elimina"
on public.user_roles for delete
to authenticated
using ((select public.is_admin()));

revoke update on public.user_roles from authenticated;
