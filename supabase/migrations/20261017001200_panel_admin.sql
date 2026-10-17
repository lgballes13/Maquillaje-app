-- ============================================================================
-- Fase 7: panel de administración completo
-- ----------------------------------------------------------------------------
-- 1. Nota interna por clienta (solo la ve la admin).
-- 2. admin_customers: lista y búsqueda de clientas con su correo (vive en
--    auth.users, que nadie lee directo) y sus totales.
-- 3. admin_report: números del negocio en un rango de fechas.
-- 4. log_admin_export: cada descarga CSV queda en la auditoría.
-- Todo exige admin con 2FA (public.is_admin()).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nota interna
-- ---------------------------------------------------------------------------
create table public.customer_notes (
  customer_id uuid primary key references public.profiles (id) on delete cascade,
  note text not null check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

comment on table public.customer_notes is 'Nota interna de la admin sobre una clienta. La clienta nunca la ve.';

create or replace function private.touch_customer_note()
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

create trigger customer_notes_touch
before insert or update on public.customer_notes
for each row execute function private.touch_customer_note();

create trigger audit_customer_notes
after insert or update or delete on public.customer_notes
for each row execute function private.audit_row_change('customer_id');

alter table public.customer_notes enable row level security;

create policy "customer_notes: admin lee"
on public.customer_notes for select to authenticated using ((select public.is_admin()));
create policy "customer_notes: admin crea"
on public.customer_notes for insert to authenticated with check ((select public.is_admin()));
create policy "customer_notes: admin edita"
on public.customer_notes for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.customer_notes from anon;
revoke all on public.customer_notes from authenticated;
grant select on public.customer_notes to authenticated;
grant insert (customer_id, note) on public.customer_notes to authenticated;
grant update (note) on public.customer_notes to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Clientas
-- ---------------------------------------------------------------------------
create or replace function private.require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Con p_customer_id devuelve solo esa clienta; si no, busca por nombre, correo
-- o teléfono (sin búsqueda, las más recientes). No incluye cuentas del equipo.
create or replace function public.admin_customers(
  p_search text default null,
  p_customer_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  full_name text,
  phone text,
  email text,
  created_at timestamptz,
  marketing_opt_in boolean,
  appointments_count integer,
  completed_count integer,
  no_show_count integer,
  orders_count integer,
  credit_cop integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pattern text;
begin
  perform private.require_admin();
  if p_search is not null and btrim(p_search) <> '' then
    -- Los comodines que escriba la admin se buscan como texto normal.
    v_pattern := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select p.id,
         p.full_name,
         p.phone,
         u.email::text,
         p.created_at,
         p.marketing_opt_in,
         (select count(*)::integer from public.appointments a
          where a.customer_id = p.id and a.status not in ('pending_payment', 'expired')),
         (select count(*)::integer from public.appointments a
          where a.customer_id = p.id and a.status = 'completed'),
         (select count(*)::integer from public.appointments a
          where a.customer_id = p.id and a.status = 'no_show'),
         (select count(*)::integer from public.orders o
          where o.customer_id = p.id and o.status not in ('pending_payment', 'expired')),
         private.credit_balance(p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where not exists (select 1 from public.user_roles r where r.user_id = p.id)
    and (p_customer_id is null or p.id = p_customer_id)
    and (v_pattern is null
         or p.full_name ilike v_pattern
         or u.email ilike v_pattern
         or coalesce(p.phone, '') ilike v_pattern)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 5000);
end;
$$;

revoke all on function private.require_admin() from public;
revoke all on function public.admin_customers(text, uuid, integer) from public, anon;
grant execute on function public.admin_customers(text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reportes
-- ---------------------------------------------------------------------------
-- Fechas en la hora de Bogotá, ambas incluidas. Máximo un año por consulta.
create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  perform private.require_admin();
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  if p_to - p_from > 366 then
    raise exception 'range_too_long' using errcode = 'P0001';
  end if;

  v_start := p_from::timestamp at time zone 'America/Bogota';
  v_end := (p_to + 1)::timestamp at time zone 'America/Bogota';

  select jsonb_build_object(
    'income', jsonb_build_object(
      'appointment_deposits_cop', coalesce((
        select (sum(amount_in_cents) / 100)::bigint from public.payments
        where status = 'approved' and approved_at >= v_start and approved_at < v_end), 0),
      'shop_cop', coalesce((
        select (sum(amount_in_cents) / 100)::bigint from public.order_payments
        where status = 'approved' and stage = 'full' and approved_at >= v_start and approved_at < v_end), 0),
      'preorder_deposits_cop', coalesce((
        select (sum(amount_in_cents) / 100)::bigint from public.order_payments
        where status = 'approved' and stage = 'deposit' and approved_at >= v_start and approved_at < v_end), 0),
      'preorder_balances_cop', coalesce((
        select (sum(amount_in_cents) / 100)::bigint from public.order_payments
        where status = 'approved' and stage = 'balance' and approved_at >= v_start and approved_at < v_end), 0)
    ),
    'appointments_by_status', coalesce((
      select jsonb_object_agg(status, total) from (
        select status, count(*)::integer as total from public.appointments
        where starts_at >= v_start and starts_at < v_end
        group by status) s), '{}'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t order by t.quantity desc, t.total_cop desc) from (
        select i.product_name as name, sum(i.quantity)::integer as quantity, sum(i.line_total_cop)::integer as total_cop
        from public.order_items i
        join public.orders o on o.id = i.order_id
        where o.status not in ('pending_payment', 'cancelled', 'expired')
          and o.created_at >= v_start and o.created_at < v_end
        group by i.product_name
        order by 2 desc, 3 desc
        limit 10) t), '[]'::jsonb),
    'credit_outstanding_cop', coalesce((
      select sum(private.credit_balance(c.customer_id))::bigint
      from (select distinct customer_id from public.credit_movements) c), 0)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_report(date, date) from public, anon;
grant execute on function public.admin_report(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Auditoría de descargas
-- ---------------------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log
  add constraint audit_log_action_check check (action in ('INSERT', 'UPDATE', 'DELETE', 'EXPORT'));

create or replace function public.log_admin_export(p_kind text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_kind not in ('citas', 'pedidos', 'clientas', 'reporte') then
    raise exception 'invalid_export' using errcode = 'P0001';
  end if;
  insert into public.audit_log (actor_id, table_name, action, record_id, new_data)
  values (auth.uid(), 'export', 'EXPORT', p_kind, coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke all on function public.log_admin_export(text, jsonb) from public, anon;
grant execute on function public.log_admin_export(text, jsonb) to authenticated;
