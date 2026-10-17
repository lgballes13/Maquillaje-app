-- ============================================================================
-- Fase 8: la clienta elimina su cuenta (Ley 1581, derecho de supresión)
-- ----------------------------------------------------------------------------
-- close_my_account() borra o anonimiza los datos de contacto de la clienta con
-- sesión. Las citas, pedidos y pagos se conservan sin datos de contacto
-- (obligaciones contables). Devuelve:
--   'delete'    → no tiene historial: la app borra el usuario por completo.
--   'anonymize' → tiene historial: la app bloquea el acceso y cambia el correo.
-- No deja cerrar la cuenta con citas o pedidos en curso.
-- ============================================================================

create or replace function public.close_my_account()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_has_history boolean;
  v_order_ids text[];
  v_appointment_ids text[];
  -- Campos con datos de contacto que se quitan también de la auditoría.
  v_personal text[] := array['full_name', 'phone', 'recipient_name', 'address', 'city', 'customer_notes', 'note'];
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if public.has_role('admin') or public.has_role('artist') then
    raise exception 'staff_account' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.appointments
    where customer_id = v_user and status in ('pending_payment', 'confirmed') and ends_at > now()
  ) then
    raise exception 'active_appointments' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.orders
    where customer_id = v_user
      and status in ('pending_payment', 'deposit_paid', 'awaiting_balance', 'paid', 'ready', 'shipped')
  ) then
    raise exception 'open_orders' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id::text), '{}') into v_order_ids from public.orders where customer_id = v_user;
  select coalesce(array_agg(id::text), '{}') into v_appointment_ids from public.appointments where customer_id = v_user;
  v_has_history := cardinality(v_order_ids) > 0 or cardinality(v_appointment_ids) > 0
    or exists (select 1 from public.credit_movements where customer_id = v_user);

  delete from public.product_waitlist where customer_id = v_user;
  delete from public.customer_notes where customer_id = v_user;

  update public.orders
  set recipient_name = 'Cuenta eliminada',
      phone = '0000000',
      address = case when address is null then null else '[eliminada]' end,
      city = case when city is null then null else '[eliminada]' end,
      customer_notes = null
  where customer_id = v_user;

  update public.appointments set customer_notes = null where customer_id = v_user;

  update public.profiles
  set full_name = 'Cuenta eliminada', phone = null, marketing_opt_in = false
  where id = v_user;

  -- La auditoría guarda copias de cada cambio: también se les quitan los datos de contacto.
  update public.audit_log
  set old_data = case when old_data is null then null else old_data - v_personal end,
      new_data = case when new_data is null then null else new_data - v_personal end
  where (table_name = 'orders' and record_id = any (v_order_ids))
     or (table_name = 'appointments' and record_id = any (v_appointment_ids))
     or (table_name = 'customer_notes' and record_id = v_user::text);

  insert into public.audit_log (actor_id, table_name, action, record_id, new_data)
  values (v_user, 'account', 'DELETE', v_user::text,
          jsonb_build_object('mode', case when v_has_history then 'anonymize' else 'delete' end));

  return case when v_has_history then 'anonymize' else 'delete' end;
end;
$$;

revoke all on function public.close_my_account() from public, anon;
grant execute on function public.close_my_account() to authenticated;
