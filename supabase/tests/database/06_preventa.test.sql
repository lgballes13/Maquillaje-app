-- ============================================================================
-- Pruebas de preventa, lista de espera y saldo a favor en la tienda (Fase 5,
-- pgTAP). Ejecutar con:
--   npx supabase test db
-- Política de la prueba: anticipo de preventa 50 %, 7 días para pagar el saldo,
-- envío $12.000, saldo a favor válido 15 días.
-- Productos: D1 $40.000 agotado, D2 $20.000 con 3 unidades, D3 agotado sin
-- preventa, D4 $30.000 agotado, D5 $10.000 con 5 unidades, D6 $8.000 agotado.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

insert into public.business_rules (
  deposit_percent, reschedule_window_hours, reschedule_penalty_percent, free_cancellation_hours,
  preorder_deposit_percent, preorder_delivery_days, preorder_balance_days, buffer_minutes,
  booking_hold_minutes, min_booking_notice_hours, max_booking_days_ahead, shipping_fee_cop,
  credit_validity_days, change_reason
) values (50, 24, 30, 48, 50, 15, 7, 15, 10, 12, 90, 12000, 15, 'Prueba pgTAP preventa');
select max(version) as rv from public.business_rules \gset

insert into public.products (id, name, price_cop, stock, allow_preorder) values
  ('dddddddd-0000-4000-8000-000000000001', 'Preventa uno', 40000, 0, true),
  ('dddddddd-0000-4000-8000-000000000002', 'Con stock', 20000, 3, true),
  ('dddddddd-0000-4000-8000-000000000003', 'Sin preventa', 25000, 0, false),
  ('dddddddd-0000-4000-8000-000000000004', 'Preventa cuatro', 30000, 0, true),
  ('dddddddd-0000-4000-8000-000000000005', 'Barato', 10000, 5, true),
  ('dddddddd-0000-4000-8000-000000000006', 'Preventa seis', 8000, 0, true);

\set d1 'dddddddd-0000-4000-8000-000000000001'
\set d2 'dddddddd-0000-4000-8000-000000000002'
\set d3 'dddddddd-0000-4000-8000-000000000003'
\set d4 'dddddddd-0000-4000-8000-000000000004'
\set d5 'dddddddd-0000-4000-8000-000000000005'
\set d6 'dddddddd-0000-4000-8000-000000000006'
\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set cliente2 '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}'
\set cliente2_id '33333333-3333-3333-3333-333333333333'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'

create function pg_temp.preorder_args(p_product uuid, p_quantity integer)
returns text language sql as $$
  select format('select public.create_preorder(%L, %s, %L, %L, %L, null, null, null, %s)',
    p_product, p_quantity, 'pickup', 'Ana Prueba', '3001234567',
    (select max(version) from public.business_rules))
$$;

-- ---------------------------------------------------------------------------
-- 1. Reservar: validaciones
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(pg_temp.preorder_args(:'d2', 1), 'P0001', 'in_stock',
  'un producto con unidades se compra normal, no se reserva');
select throws_ok(pg_temp.preorder_args(:'d3', 1), 'P0001', 'preorder_unavailable',
  'un producto sin preventa no se puede reservar');
select throws_ok(pg_temp.preorder_args(:'d1', 0), 'P0001', 'invalid_items', 'cantidad cero');
select throws_ok(pg_temp.preorder_args(:'d1', 11), 'P0001', 'invalid_items', 'más de 10 unidades');
select throws_ok(format('select public.create_preorder(%L, 1, %L, %L, %L, null, null, null, %s)',
  :'d1', 'pickup', 'Ana Prueba', '3001234567', :rv - 1), 'P0001', 'policy_changed',
  'si la política cambió, se rechaza');

-- ---------------------------------------------------------------------------
-- 2. Reserva, anticipo, llegada y saldo
-- ---------------------------------------------------------------------------
select public.create_preorder(:'d1', 2, 'pickup', 'Ana Prueba', '3001234567', null, null, null, :rv) as o1 \gset
select is((select kind || '/' || status || '/' || deposit_cop || '/' || total_cop from public.orders where id = :'o1'),
  'preorder/pending_payment/40000/80000', 'reserva de 2 × $40.000: anticipo del 50 % = $40.000');
select is((select available from public.get_product_availability(array[:'d1'::uuid])), 0,
  'una reserva sin llegar no aparta stock');

select reference as ref1, amount_in_cents as amt1 from public.prepare_order_payment(:'o1') \gset
select is(:amt1::bigint, 4000000::bigint, 'en la pasarela se cobra solo el anticipo');
select is((select stage::text from public.order_payments where reference = :'ref1'), 'deposit',
  'el pago queda marcado como anticipo');
reset role;

set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:pre-o1:APPROVED', :'ref1', 'pre-o1',
  'APPROVED', :amt1, 'COP'), 'deposit_paid', 'anticipo aprobado');
reset role;
select is((select status::text from public.orders where id = :'o1'), 'deposit_paid',
  'la reserva queda esperando el producto');

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(format('select public.cancel_my_order(%L)', :'o1'), 'P0001', 'not_cancellable',
  'con el anticipo pagado la clienta ya no cancela desde la app');
select throws_ok(format('select public.prepare_order_payment(%L)', :'o1'), 'P0001', 'already_paid',
  'no se puede pagar otra vez mientras espera el producto');
select throws_ok(format('select public.mark_preorder_arrived(%L)', :'o1'), '42501', null,
  'la clienta no puede marcar la llegada');
reset role;

set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select throws_ok(format('select public.mark_preorder_arrived(%L)', :'o1'), 'P0001', 'out_of_stock',
  'sin unidades en el estudio no se puede marcar la llegada');
update public.products set stock = 3 where id = :'d1';
select is(public.mark_preorder_arrived(:'o1')::text, 'awaiting_balance', 'admin: llegó el producto');
reset role;
select is((select balance_due_at from public.orders where id = :'o1'), now() + interval '7 days',
  'la clienta tiene 7 días para pagar el saldo');
select is((select available from public.get_product_availability(array[:'d1'::uuid])), 1,
  'las 2 unidades quedan apartadas para ella: solo 1 disponible');

set local role authenticated;
set local request.jwt.claims to :'cliente2';
select throws_ok(format('select public.create_order(%L::jsonb, %L, %L, %L, null, null, null, %s)',
  format('[{"product_id":"%s","quantity":2}]', :'d1'), 'pickup', 'Otra Clienta', '3001234567', :rv),
  'P0001', 'out_of_stock', 'otra clienta no puede comprar las unidades apartadas');
reset role;

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select reference as ref1b, amount_in_cents as amt1b from public.prepare_order_payment(:'o1') \gset
select is(:amt1b::bigint, 4000000::bigint, 'el saldo es el total menos el anticipo');
reset role;

set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:pre-o1b:APPROVED', :'ref1b', 'pre-o1b',
  'APPROVED', :amt1b, 'COP'), 'paid', 'saldo pagado');
reset role;
select is((select status::text from public.orders where id = :'o1'), 'paid',
  'la preventa sigue como un pedido pagado');
select is((select stock from public.products where id = :'d1'), 1, 'y se descuentan sus unidades');

-- ---------------------------------------------------------------------------
-- 3. No paga el saldo: el anticipo pasa a saldo a favor
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select public.create_preorder(:'d4', 1, 'pickup', 'Bea Prueba', '3001234567', null, null, null, :rv) as o2 \gset
select reference as ref2, amount_in_cents as amt2 from public.prepare_order_payment(:'o2') \gset
reset role;
set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:pre-o2:APPROVED', :'ref2', 'pre-o2',
  'APPROVED', :amt2, 'COP'), 'deposit_paid', 'anticipo de $15.000 pagado');
reset role;

update public.products set stock = 1 where id = :'d4';
set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select public.mark_preorder_arrived(:'o2') as arrived2 \gset
reset role;
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select reference as ref2b, amount_in_cents as amt2b from public.prepare_order_payment(:'o2') \gset
reset role;

update public.orders set balance_due_at = now() - interval '1 minute' where id = :'o2';
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select throws_ok(format('select public.prepare_order_payment(%L)', :'o2'), 'P0001', 'hold_expired',
  'vencido el plazo, ya no se puede pagar el saldo');
reset role;

set local role service_role;
select cmp_ok(public.expire_orders(), '>=', 1, 'la tarea diaria procesa la preventa vencida');
reset role;
select is((select status::text from public.orders where id = :'o2'), 'cancelled', 'la preventa se cancela');
select is((select amount_cop from public.credit_movements where order_id = :'o2' and reason = 'preorder_unpaid'),
  15000, 'todo el anticipo queda como saldo a favor');
select is((select expires_at from public.credit_movements where order_id = :'o2' and reason = 'preorder_unpaid'),
  now() + interval '15 days', 'y vence a los 15 días, como el de las citas');
select is((select available from public.get_product_availability(array[:'d4'::uuid])), 1,
  'la unidad queda libre para otra persona');

set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:pre-o2b:APPROVED', :'ref2b', 'pre-o2b',
  'APPROVED', :amt2b, 'COP'), 'paid_inactive', 'un saldo pagado después del plazo queda por revisar');
reset role;
select is((select needs_review from public.orders where id = :'o2'), true, 'marcado por revisar');

-- ---------------------------------------------------------------------------
-- 4. Saldo a favor en la tienda
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select is(public.my_credit_balance(), 15000, 'la clienta tiene $15.000 a favor');
select public.create_order(format('[{"product_id":"%s","quantity":1}]', :'d2')::jsonb,
  'pickup', 'Bea Prueba', '3001234567', null, null, null, :rv) as o3 \gset
select is((select credit_applied_cop || '/' || status from public.orders where id = :'o3'),
  '15000/pending_payment', 'compra de $20.000: se usan los $15.000 a favor');
select is((select amount_in_cents from public.prepare_order_payment(:'o3')), 500000::bigint,
  'en la pasarela solo se cobran los $5.000 que faltan');
select is(public.my_credit_balance(), 0, 'el saldo queda en cero');
select lives_ok(format('select public.cancel_my_order(%L)', :'o3'), 'cancela la compra sin pagar');
select is(public.my_credit_balance(), 15000, 'el saldo vuelve a estar disponible');

select public.create_order(format('[{"product_id":"%s","quantity":1}]', :'d5')::jsonb,
  'pickup', 'Bea Prueba', '3001234567', null, null, null, :rv) as o4 \gset
select is((select status || '/' || credit_applied_cop from public.orders where id = :'o4'), 'paid/10000',
  'si el saldo cubre todo, la compra queda pagada sin pasar por la pasarela');
select is((select stock from public.products where id = :'d5'), 4, 'y se descuenta del stock');

select public.create_preorder(:'d6', 1, 'pickup', 'Bea Prueba', '3001234567', null, null, null, :rv) as o5 \gset
select is((select status || '/' || credit_applied_cop from public.orders where id = :'o5'), 'deposit_paid/4000',
  'reserva cuyo anticipo cubre el saldo a favor: queda reservada sin pagar');
select is(public.my_credit_balance(), 1000, 'quedan $1.000 a favor');
reset role;

set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select lives_ok(format('select public.set_order_status(%L, %L)', :'o5', 'cancelled'),
  'admin: cancela una preventa con anticipo');
reset role;
select is((select needs_review from public.orders where id = :'o5'), true, 'queda por revisar');
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select is(public.my_credit_balance(), 5000, 'el saldo a favor que se usó vuelve a la clienta');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Lista de espera
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select lives_ok(format('insert into public.product_waitlist (product_id, customer_id) values (%L, auth.uid())', :'d6'),
  'la clienta se inscribe para el aviso');
select throws_ok(format('insert into public.product_waitlist (product_id, customer_id) values (%L, %L)', :'d4', :'cliente2_id'),
  '42501', null, 'no puede inscribir a otra persona');
select throws_ok(format('insert into public.product_waitlist (product_id, customer_id, notified_at) values (%L, auth.uid(), now())', :'d4'),
  '42501', null, 'no puede marcar el aviso como enviado');
reset role;
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select is((select count(*)::integer from public.product_waitlist), 0, 'otra clienta no ve la inscripción');
reset role;

select * from finish();
rollback;
