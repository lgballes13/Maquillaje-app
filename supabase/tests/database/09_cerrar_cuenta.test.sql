-- ============================================================================
-- Pruebas de «eliminar mi cuenta» (Fase 8, pgTAP). Ejecutar con:
--   npx supabase test db
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

\set c1 '22222222-2222-2222-2222-222222222222'
\set c2 '33333333-3333-3333-3333-333333333333'
\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set cliente2 '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'

select id as svc from public.services order by sort_order limit 1 \gset
select max(version) as rv from public.business_rules \gset

-- Clienta 1: una cita futura confirmada, un pedido entregado con dirección y una nota interna.
insert into public.appointments (
  id, customer_id, service_id, service_name, duration_minutes, price_cop, rules_version,
  deposit_percent, deposit_cop, policy_accepted_at, starts_at, ends_at, blocked_until,
  status, confirmed_at, customer_notes
) values (
  'aaaaaaaa-9999-4000-8000-000000000001', :'c1', :'svc', 'Maquillaje social', 60, 180000, :rv, 50, 90000, now(),
  '2031-05-10 15:00+00', '2031-05-10 16:00+00', '2031-05-10 16:15+00', 'confirmed', now(), 'Tengo alergia al látex'
);
insert into public.orders (id, customer_id, delivery_method, phone, recipient_name, address, city, rules_version,
  shipping_cop, subtotal_cop, total_cop, status, paid_at)
values ('dddddddd-9999-4000-8000-000000000001', :'c1', 'shipping', '3001234567', 'Cliente Demo',
  'Calle 1 # 2-3', 'Bogotá', :rv, 12000, 45000, 57000, 'delivered', now());
insert into public.customer_notes (customer_id, note) values (:'c1', 'Piel sensible');
insert into public.product_waitlist (customer_id, product_id) values (:'c1', 'bbbbbbbb-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- 1. No se cierra con una cita en curso
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok('select public.close_my_account()', 'P0001', 'active_appointments',
  'con una cita confirmada por venir no se puede cerrar la cuenta');

reset role;
update public.appointments set status = 'cancelled', cancelled_at = now()
where id = 'aaaaaaaa-9999-4000-8000-000000000001';
update public.orders set status = 'paid' where id = 'dddddddd-9999-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok('select public.close_my_account()', 'P0001', 'open_orders',
  'con un pedido sin entregar no se puede cerrar la cuenta');

reset role;
update public.orders set status = 'delivered' where id = 'dddddddd-9999-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 2. Con historial: se anonimiza
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is(public.close_my_account(), 'anonymize', 'con historial, la cuenta se anonimiza');

reset role;
select is((select full_name from public.profiles where id = :'c1'), 'Cuenta eliminada', 'el nombre se borra');
select is((select phone from public.profiles where id = :'c1'), null, 'el celular se borra');
select is((select recipient_name || ' / ' || phone || ' / ' || address || ' / ' || city
           from public.orders where id = 'dddddddd-9999-4000-8000-000000000001'),
  'Cuenta eliminada / 0000000 / [eliminada] / [eliminada]', 'el pedido queda sin datos de contacto');
select is((select total_cop from public.orders where id = 'dddddddd-9999-4000-8000-000000000001'), 57000,
  'el pedido conserva sus valores (obligaciones contables)');
select is((select customer_notes from public.appointments where id = 'aaaaaaaa-9999-4000-8000-000000000001'), null,
  'las notas de la cita se borran');
select is((select count(*)::int from public.customer_notes where customer_id = :'c1'), 0, 'la nota interna se borra');
select is((select count(*)::int from public.product_waitlist where customer_id = :'c1'), 0,
  'sale de las listas de espera');
select is((select count(*)::int from public.audit_log
           where (old_data::text like '%Calle 1%' or new_data::text like '%Calle 1%'
                  or old_data::text like '%látex%' or new_data::text like '%látex%'
                  or old_data::text like '%Piel sensible%' or new_data::text like '%Piel sensible%')), 0,
  'la auditoría tampoco guarda sus datos de contacto ni sus notas');
select is((select count(*)::int from public.audit_log where table_name = 'account' and record_id = :'c1'), 1,
  'queda registro de que la cuenta se cerró');

-- ---------------------------------------------------------------------------
-- 3. Sin historial: se puede borrar del todo; el equipo no usa esta opción
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select is(public.close_my_account(), 'delete', 'sin historial, la cuenta se borra por completo');

set local request.jwt.claims to :'admin2fa';
select throws_ok('select public.close_my_account()', 'P0001', 'staff_account',
  'una cuenta del equipo no se cierra desde aquí');

select * from finish();
rollback;
