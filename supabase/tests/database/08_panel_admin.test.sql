-- ============================================================================
-- Pruebas del panel de administración (Fase 7, pgTAP). Ejecutar con:
--   npx supabase test db
-- Datos de la prueba en febrero de 2031 (hora de Bogotá), lejos de todo lo demás.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set admin1fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'
\set c1 '22222222-2222-2222-2222-222222222222'
\set c2 '33333333-3333-3333-3333-333333333333'

select id as svc from public.services order by sort_order limit 1 \gset
select max(version) as rv from public.business_rules \gset

-- Dos citas de la clienta 1 (una asistió y otra no) y una de la clienta 2.
create temporary table t_appts (name text, id uuid);
with rows (name, customer_id, starts_at, status) as (values
  ('asistio', :'c1'::uuid, '2031-02-10 09:00-05'::timestamptz, 'completed'::public.appointment_status),
  ('falto', :'c1'::uuid, '2031-02-11 09:00-05'::timestamptz, 'no_show'::public.appointment_status),
  ('otra', :'c2'::uuid, '2031-02-28 23:00-05'::timestamptz, 'confirmed'::public.appointment_status)),
inserted as (
  insert into public.appointments (
    customer_id, service_id, service_name, duration_minutes, price_cop, rules_version,
    deposit_percent, deposit_cop, policy_accepted_at, starts_at, ends_at, blocked_until,
    status, confirmed_at, customer_notes
  )
  select customer_id, :'svc', 'Maquillaje social', 60, 180000, :rv, 50, 90000, now(),
         starts_at, starts_at + interval '60 minutes', starts_at + interval '75 minutes',
         status, now(), name
  from rows
  returning id, customer_notes
)
insert into t_appts select customer_notes, id from inserted;

insert into public.payments (appointment_id, reference, amount_in_cents, status, approved_at)
select id, 'REPORTE-' || name, 9000000, 'approved', '2031-02-05 10:00-05'
from t_appts where name in ('asistio', 'falto');
-- Aprobado justo después del rango (1 de marzo en Bogotá): no cuenta.
insert into public.payments (appointment_id, reference, amount_in_cents, status, approved_at)
select id, 'REPORTE-otra', 9000000, 'approved', '2031-03-01 00:30-05' from t_appts where name = 'otra';

-- Un pedido pagado de la clienta 1 con dos productos.
insert into public.orders (id, customer_id, delivery_method, phone, recipient_name, rules_version,
  shipping_cop, subtotal_cop, total_cop, status, paid_at, created_at)
values ('dddddddd-0000-4000-8000-000000000001', :'c1', 'pickup', '3001234567', 'Cliente Demo', :rv,
  0, 135000, 135000, 'paid', '2031-02-12 10:00-05', '2031-02-12 09:50-05');
insert into public.order_items (order_id, product_id, product_name, quantity, unit_price_cop, line_total_cop)
values ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Labial líquido mate', 2, 45000, 90000),
       ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Base de larga duración', 1, 45000, 45000);
insert into public.order_payments (order_id, reference, amount_in_cents, status, stage, approved_at)
values ('dddddddd-0000-4000-8000-000000000001', 'REPORTE-PEDIDO', 13500000, 'approved', 'full', '2031-02-12 10:00-05');

insert into public.credit_movements (customer_id, amount_cop, reason, expires_at)
values (:'c1', 25000, 'cancellation', now() + interval '10 days');

-- ---------------------------------------------------------------------------
-- 1. Clientas
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'admin2fa';

select is((select count(*)::int from public.admin_customers() where id = '11111111-1111-1111-1111-111111111111'), 0,
  'la lista de clientas no incluye cuentas del equipo');
select is((select email from public.admin_customers(null, :'c1')), 'cliente@demo.example',
  'la admin ve el correo de la clienta');
select is((select appointments_count from public.admin_customers(null, :'c1')), 2,
  'cuenta las citas de la clienta');
select is((select completed_count from public.admin_customers(null, :'c1')), 1, 'cuenta las asistencias');
select is((select no_show_count from public.admin_customers(null, :'c1')), 1, 'cuenta las inasistencias');
select is((select orders_count from public.admin_customers(null, :'c1')), 1, 'cuenta los pedidos');
select is((select credit_cop from public.admin_customers(null, :'c1')), 25000, 'muestra el saldo a favor vigente');
select is((select count(*)::int from public.admin_customers('cliente2@demo')), 1, 'busca por correo');
select is((select count(*)::int from public.admin_customers('cliente dos')), 1,
  'busca por nombre sin importar mayúsculas');
select is((select count(*)::int from public.admin_customers('%')), 0,
  'un comodín se busca como texto, no trae a todas');

set local request.jwt.claims to :'admin1fa';
select throws_ok('select * from public.admin_customers()', '42501', null,
  'sin 2FA la admin no ve la lista de clientas');
set local request.jwt.claims to :'cliente1';
select throws_ok('select * from public.admin_customers()', '42501', null,
  'una clienta no ve la lista de clientas');
reset role;
set local role anon;
select throws_ok('select * from public.admin_customers()', '42501', null,
  'un visitante no ve la lista de clientas');

-- ---------------------------------------------------------------------------
-- 2. Nota interna
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select lives_ok(format($$insert into public.customer_notes (customer_id, note) values (%L, 'Piel sensible')$$, :'c1'),
  'la admin escribe una nota interna');
select lives_ok(format($$update public.customer_notes set note = 'Piel sensible, sin látex' where customer_id = %L$$, :'c1'),
  'la admin edita la nota');
select is((select updated_by from public.customer_notes where customer_id = :'c1'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'queda quién la editó');
select is((select count(*)::int from public.audit_log where table_name = 'customer_notes' and record_id = :'c1'), 2,
  'los cambios de la nota quedan en la auditoría');

set local request.jwt.claims to :'cliente1';
select is((select count(*)::int from public.customer_notes), 0, 'la clienta no ve su nota interna');
update public.customer_notes set note = 'x' where customer_id = :'c1';
set local request.jwt.claims to :'admin2fa';
select is((select note from public.customer_notes where customer_id = :'c1'), 'Piel sensible, sin látex',
  'la clienta no puede cambiar la nota');

-- ---------------------------------------------------------------------------
-- 3. Reporte de febrero de 2031
-- ---------------------------------------------------------------------------
set local request.jwt.claims to :'admin2fa';
select public.admin_report('2031-02-01', '2031-02-28') as report \gset

select is((:'report'::jsonb #>> '{income,appointment_deposits_cop}')::int, 180000,
  'suma los anticipos de citas aprobados dentro del rango (no el del 1 de marzo)');
select is((:'report'::jsonb #>> '{income,shop_cop}')::int, 135000, 'suma las compras de la tienda');
select is((:'report'::jsonb #>> '{appointments_by_status,completed}')::int, 1, 'cuenta las citas asistidas');
select is((:'report'::jsonb #>> '{appointments_by_status,confirmed}')::int, 1,
  'la cita del 28 a las 11 p. m. en Bogotá cuenta en febrero');
select is(:'report'::jsonb #>> '{top_products,0,name}', 'Labial líquido mate',
  'el producto más vendido va primero');
select is((:'report'::jsonb ->> 'credit_outstanding_cop')::int >= 25000, true,
  'incluye el saldo a favor vigente');
select throws_ok($$select public.admin_report('2031-02-10', '2031-02-01')$$, 'P0001', 'invalid_range',
  'un rango al revés se rechaza');

-- ---------------------------------------------------------------------------
-- 4. Auditoría de descargas
-- ---------------------------------------------------------------------------
select public.log_admin_export('clientas', '{"filas": 2}'::jsonb);
select is((select count(*)::int from public.audit_log where action = 'EXPORT' and record_id = 'clientas'
           and actor_id = '11111111-1111-1111-1111-111111111111'), 1,
  'la descarga queda en la auditoría con quién la hizo');

set local request.jwt.claims to :'cliente1';
select throws_ok($$select public.log_admin_export('clientas')$$, '42501', null,
  'una clienta no puede registrar descargas');

select * from finish();
rollback;
