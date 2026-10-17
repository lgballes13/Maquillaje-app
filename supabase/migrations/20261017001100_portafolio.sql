-- ============================================================================
-- Fase 6 · Portafolio con autorización de fotos (Ley 1581 de 2012)
-- ----------------------------------------------------------------------------
-- Un trabajo del portafolio (portfolio_works) tiene fotos de antes y después
-- (portfolio_images) y SIEMPRE está ligado a la autorización firmada de la
-- clienta (portfolio_consents). El formato firmado se guarda en un bucket
-- PRIVADO ("autorizaciones") que solo ve la admin.
--
-- Reglas que la base hace cumplir (aunque la app falle):
--   · Solo se publica un trabajo con autorización vigente y al menos una foto
--     de «después».
--   · Si la clienta retira la autorización, sus trabajos se ocultan solos.
--   · Si se borra la última foto de «después», el trabajo se oculta.
--   · La autorización no se borra (queda el historial); se marca retirada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 40),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

create table public.portfolio_consents (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 3 and 100),
  -- Fecha en que la clienta firmó el formato.
  signed_on date not null,
  -- Ruta del formato firmado (foto o PDF) dentro del bucket privado "autorizaciones".
  document_path text not null unique check (char_length(document_path) <= 200),
  notes text check (char_length(notes) <= 500),
  revoked_at timestamptz,
  revoked_reason text check (char_length(revoked_reason) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

comment on table public.portfolio_consents is
  'Autorizaciones firmadas para publicar fotos (Ley 1581). No se borran: se marcan retiradas.';

create table public.portfolio_works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  category_id uuid references public.portfolio_categories (id) on delete set null,
  -- Servicio al que lleva «Agendar este estilo».
  service_id uuid references public.services (id) on delete set null,
  consent_id uuid not null references public.portfolio_consents (id) on delete restrict,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index portfolio_works_published_idx on public.portfolio_works (is_published, sort_order, created_at desc);
create index portfolio_works_category_idx on public.portfolio_works (category_id);
create index portfolio_works_consent_idx on public.portfolio_works (consent_id);

create type public.portfolio_image_kind as enum ('before', 'after');

create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.portfolio_works (id) on delete cascade,
  kind public.portfolio_image_kind not null,
  -- Ruta dentro del bucket público "portafolio".
  storage_path text not null unique check (char_length(storage_path) <= 200),
  alt_text text not null check (char_length(alt_text) between 3 and 150),
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index portfolio_images_work_idx on public.portfolio_images (work_id, kind, sort_order);

-- ---------------------------------------------------------------------------
-- Reglas de publicación
-- ---------------------------------------------------------------------------
create or replace function private.check_portfolio_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published then
    if not exists (
      select 1 from public.portfolio_consents c
      where c.id = new.consent_id and c.revoked_at is null
    ) then
      raise exception 'consent_required';
    end if;
    if not exists (
      select 1 from public.portfolio_images i
      where i.work_id = new.id and i.kind = 'after'
    ) then
      raise exception 'after_photo_required';
    end if;
    if tg_op = 'INSERT' or not old.is_published then
      new.published_at := now();
    end if;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger portfolio_works_check_publish
before insert or update on public.portfolio_works
for each row execute function private.check_portfolio_publish();

-- Retirar la autorización oculta todos sus trabajos.
create or replace function private.hide_works_on_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update public.portfolio_works
    set is_published = false
    where consent_id = new.id and is_published;
  end if;
  return new;
end;
$$;

create trigger portfolio_consents_hide_on_revoke
after update of revoked_at on public.portfolio_consents
for each row execute function private.hide_works_on_revoke();

-- Una autorización retirada no se puede volver a activar (se registra una nueva).
create or replace function private.consent_revoke_is_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'consent_revoked';
  end if;
  return new;
end;
$$;

create trigger portfolio_consents_revoke_final
before update on public.portfolio_consents
for each row execute function private.consent_revoke_is_final();

-- Sin foto de «después», el trabajo no se puede ver.
create or replace function private.hide_work_without_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.kind = 'after' and not exists (
    select 1 from public.portfolio_images i where i.work_id = old.work_id and i.kind = 'after'
  ) then
    update public.portfolio_works set is_published = false
    where id = old.work_id and is_published;
  end if;
  return old;
end;
$$;

create trigger portfolio_images_hide_without_after
after delete on public.portfolio_images
for each row execute function private.hide_work_without_after();

revoke all on function private.check_portfolio_publish() from public;
revoke all on function private.hide_works_on_revoke() from public;
revoke all on function private.consent_revoke_is_final() from public;
revoke all on function private.hide_work_without_after() from public;

-- ---------------------------------------------------------------------------
-- Fechas, autor y auditoría
-- ---------------------------------------------------------------------------
create trigger portfolio_categories_set_updated
before update on public.portfolio_categories
for each row execute function private.set_updated_fields();

create trigger portfolio_works_set_updated
before update on public.portfolio_works
for each row execute function private.set_updated_fields();

create trigger audit_portfolio_categories
after insert or update or delete on public.portfolio_categories
for each row execute function private.audit_row_change('id');

create trigger audit_portfolio_consents
after insert or update or delete on public.portfolio_consents
for each row execute function private.audit_row_change('id');

create trigger audit_portfolio_works
after insert or update or delete on public.portfolio_works
for each row execute function private.audit_row_change('id');

create trigger audit_portfolio_images
after insert or update or delete on public.portfolio_images
for each row execute function private.audit_row_change('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.portfolio_categories enable row level security;
alter table public.portfolio_consents enable row level security;
alter table public.portfolio_works enable row level security;
alter table public.portfolio_images enable row level security;

create policy "portfolio_categories: visitantes ven las activas"
on public.portfolio_categories for select to anon using (is_active);
create policy "portfolio_categories: usuarios ven las activas y el admin todas"
on public.portfolio_categories for select to authenticated
using (is_active or (select public.is_admin()));
create policy "portfolio_categories: admin crea"
on public.portfolio_categories for insert to authenticated with check ((select public.is_admin()));
create policy "portfolio_categories: admin edita"
on public.portfolio_categories for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- Las autorizaciones (nombre de la clienta y su documento) solo las ve la admin.
create policy "portfolio_consents: admin ve"
on public.portfolio_consents for select to authenticated using ((select public.is_admin()));
create policy "portfolio_consents: admin registra"
on public.portfolio_consents for insert to authenticated with check ((select public.is_admin()));
create policy "portfolio_consents: admin retira"
on public.portfolio_consents for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "portfolio_works: visitantes ven los publicados"
on public.portfolio_works for select to anon using (is_published);
create policy "portfolio_works: usuarios ven los publicados y el admin todos"
on public.portfolio_works for select to authenticated
using (is_published or (select public.is_admin()));
create policy "portfolio_works: admin crea"
on public.portfolio_works for insert to authenticated with check ((select public.is_admin()));
create policy "portfolio_works: admin edita"
on public.portfolio_works for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "portfolio_images: visitantes ven las de trabajos publicados"
on public.portfolio_images for select to anon
using (exists (select 1 from public.portfolio_works w where w.id = work_id and w.is_published));
create policy "portfolio_images: usuarios ven las publicadas y el admin todas"
on public.portfolio_images for select to authenticated
using (
  (select public.is_admin())
  or exists (select 1 from public.portfolio_works w where w.id = work_id and w.is_published)
);
create policy "portfolio_images: admin crea"
on public.portfolio_images for insert to authenticated with check ((select public.is_admin()));
create policy "portfolio_images: admin borra"
on public.portfolio_images for delete to authenticated using ((select public.is_admin()));

revoke all on public.portfolio_consents from anon;
revoke insert, update, delete, truncate on public.portfolio_categories, public.portfolio_works, public.portfolio_images
  from anon;
revoke delete, truncate on public.portfolio_categories, public.portfolio_consents, public.portfolio_works
  from authenticated;
revoke update, truncate on public.portfolio_images from authenticated;
-- Columnas que la admin puede cambiar (fechas, autor y publicación las pone la base).
revoke update on public.portfolio_categories from authenticated;
grant update (name, sort_order, is_active) on public.portfolio_categories to authenticated;
revoke update on public.portfolio_works from authenticated;
grant update (title, description, category_id, service_id, is_published, sort_order)
  on public.portfolio_works to authenticated;
revoke update on public.portfolio_consents from authenticated;
grant update (notes, revoked_at, revoked_reason) on public.portfolio_consents to authenticated;
revoke insert on public.portfolio_works from authenticated;
grant insert (id, title, description, category_id, service_id, consent_id, sort_order)
  on public.portfolio_works to authenticated;

-- ---------------------------------------------------------------------------
-- Archivos
-- ---------------------------------------------------------------------------
-- Fotos del portafolio: bucket público (cualquiera las ve; solo la admin sube o borra).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portafolio', 'portafolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "portafolio: admin sube fotos"
on storage.objects for insert to authenticated
with check (bucket_id = 'portafolio' and (select public.is_admin()));
create policy "portafolio: admin ve fotos"
on storage.objects for select to authenticated
using (bucket_id = 'portafolio' and (select public.is_admin()));
create policy "portafolio: admin borra fotos"
on storage.objects for delete to authenticated
using (bucket_id = 'portafolio' and (select public.is_admin()));

-- Formatos firmados: bucket PRIVADO. Solo la admin sube y ve; nadie los borra
-- desde la app (son la prueba de la autorización).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('autorizaciones', 'autorizaciones', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "autorizaciones: admin sube formatos"
on storage.objects for insert to authenticated
with check (bucket_id = 'autorizaciones' and (select public.is_admin()));
create policy "autorizaciones: admin ve formatos"
on storage.objects for select to authenticated
using (bucket_id = 'autorizaciones' and (select public.is_admin()));
