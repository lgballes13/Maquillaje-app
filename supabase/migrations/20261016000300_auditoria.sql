-- ============================================================================
-- Fase 1 · Migración 3: registro de auditoría
-- ----------------------------------------------------------------------------
-- Guarda quién cambió qué y cuándo. Lo llenan triggers automáticamente:
-- nadie (ni el admin) puede escribir, editar ni borrar registros a mano.
-- ============================================================================

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- Sin llave foránea a propósito: el registro se conserva aunque el usuario se elimine.
  actor_id uuid,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  old_data jsonb,
  new_data jsonb
);

comment on table public.audit_log is 'Registro de auditoría inmutable. Solo lectura para admin con 2FA.';

create index audit_log_table_time_idx on public.audit_log (table_name, occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);

-- Trigger genérico. Recibe como argumento el nombre de la columna llave.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_pk text := tg_argv[0];
begin
  insert into public.audit_log (actor_id, table_name, action, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name,
    tg_op,
    coalesce(v_new ->> v_pk, v_old ->> v_pk),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_business_rules
after insert or update or delete on public.business_rules
for each row execute function private.audit_row_change('version');

create trigger audit_business_hours
after insert or update or delete on public.business_hours
for each row execute function private.audit_row_change('weekday');

create trigger audit_user_roles
after insert or update or delete on public.user_roles
for each row execute function private.audit_row_change('user_id');

-- RLS: solo lectura para admin con 2FA.
alter table public.audit_log enable row level security;

create policy "audit_log: admin lee"
on public.audit_log for select
to authenticated
using ((select public.is_admin()));

revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
