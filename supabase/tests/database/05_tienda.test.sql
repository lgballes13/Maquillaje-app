-- ============================================================================
-- Pruebas de base de datos de la tienda (Fase 4, pgTAP). Ejecutar con:
--   npx supabase test db
-- Productos de la prueba: P1 $50.000 con 2 unidades, P2 $30.000 con 10 unidades,
-- P3 inactivo. Envío fijo de la prueba: $12.000.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

insert into public.business_rules (
  deposit_percent, reschedule_window_hours, reschedule_penalty_percent, free_cancellation_hours,
  preorder_deposit_percent, preorder_delivery_days, buffer_minutes, booking_hold_minutes,
  min_booking_notice_hours, max_booking_days_ahead, shipping_fee_cop, change_reason
) values (50, 24, 30, 48, 50, 15, 15, 10, 12, 90, 12000, 'Prueba pgTAP tienda');
select max(version) as rv from public.business_rules \gset

insert into public.products (id, name, price_cop, stock, is_active) values
  ('cccccccc-0000-0000-0000-000000000001', 'Producto prueba uno', 50000, 2, true),
  ('cccccccc-0000-0000-0000-000000000002', 'Producto prueba dos', 30000, 10, true),
  ('cccccccc-0000-0000-0000-000000000003', 'Producto prueba inactivo', 20000, 5, false);

\set p1 'cccccccc-0000-0000-0000-000000000001'
\set p2 'cccccccc-0000-0000-0000-000000000002'
\set p3 'cccccccc-0000-0000-0000-000000000003'
\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set cliente2 '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'

create function pg_temp.order_args(p_items text, p_method text default 'pickup')
returns text language sql as $$
  select format('select public.create_order(%L::jsonb, %L, %L, %L, %L, %L, null, %s)',
    p_items, p_method, 'Ana Prueba', '3001234567',
    case when p_method = 'shipping' then 'Calle 1 # 2-3' end,
    case when p_method = 'shipping' then 'Bogotá' end,
    (select max(version) from public.business_rules))
$$;

-- ---------------------------------------------------------------------------
-- 1. Catálogo y RLS
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*)::integer from public.products where id in (:'p1', :'p2', :'p3')), 2,
  'visitante: ve solo los productos activos');
select throws_ok($$insert into public.products (name, price_cop) values ('Intruso', 1000)$$, '42501', null,
  'visitante: no puede crear productos');
select is((select available from public.get_product_availability(array[:'p1'::uuid])), 2,
  'visitante: ve cuántas unidades hay disponibles');
select is((select count(*)::integer from public.get_product_availability(array[:'p3'::uuid])), 0,
  'la disponibilidad no muestra productos inactivos');
reset role;

set local role authenticated;
set local request.jwt.claims to :'cliente1';
with changed as (update public.products set price_cop = 1000 where id = :'p1' returning 1)
select is((select count(*)::integer from changed), 0, 'clienta: no puede cambiar precios (RLS)');
select throws_ok($$insert into public.orders (customer_id, delivery_method, recipient_name, phone, rules_version, subtotal_cop, shipping_cop, total_cop, hold_expires_at)
  values (auth.uid(), 'pickup', 'Ana', '3001234567', 1, 1000, 0, 1000, now())$$, '42501', null,
  'clienta: no puede crear pedidos a mano');

-- ---------------------------------------------------------------------------
-- 2. Crear pedidos: validaciones
-- ---------------------------------------------------------------------------
select throws_ok(pg_temp.order_args('[]'), 'P0001', 'invalid_items', 'pedido vacío');
select throws_ok(pg_temp.order_args(format('[{"product_id":"%s","quantity":0}]', :'p2')), 'P0001',
  'invalid_items', 'cantidad cero');
select throws_ok(pg_temp.order_args(format('[{"product_id":"%s","quantity":11}]', :'p2')), 'P0001',
  'invalid_items', 'más de 10 unidades de un producto');
select throws_ok(pg_temp.order_args(format('[{"product_id":"%s","quantity":1.5}]', :'p2')), 'P0001',
  'invalid_items', 'cantidad con decimales');
select throws_ok(pg_temp.order_args(format('[{"product_id":"%1$s","quantity":1},{"product_id":"%1$s","quantity":1}]', :'p2')),
  'P0001', 'invalid_items', 'producto repetido');
select throws_ok(pg_temp.order_args(format('[{"product_id":"%s","quantity":1}]', :'p3')), 'P0001',
  'product_unavailable', 'producto inactivo');
select throws_ok(pg_temp.order_args(format('[{"product_id":"%s","quantity":3}]', :'p1')), 'P0001',
  'out_of_stock', 'más unidades de las que hay');
select throws_ok(format('select public.create_order(%L::jsonb, %L, %L, %L, null, null, null, %s)',
  format('[{"product_id":"%s","quantity":1}]', :'p2'), 'shipping', 'Ana Prueba', '3001234567', :rv),
  'P0001', 'invalid_delivery', 'envío sin dirección');
select throws_ok(format('select public.create_order(%L::jsonb, %L, %L, %L, null, null, null, %s)',
  format('[{"product_id":"%s","quantity":1}]', :'p2'), 'pickup', 'Ana Prueba', '3001234567', :rv - 1),
  'P0001', 'policy_changed', 'si las reglas cambiaron, se rechaza');

-- ---------------------------------------------------------------------------
-- 3. Totales y stock apartado
-- ---------------------------------------------------------------------------
select public.create_order(format('[{"product_id":"%s","quantity":2},{"product_id":"%s","quantity":1}]', :'p1', :'p2')::jsonb,
  'shipping', 'Ana Prueba', '3001234567', 'Calle 1 # 2-3', 'Bogotá', null, :rv) as o1 \gset
select is((select subtotal_cop || '/' || shipping_cop || '/' || total_cop from public.orders where id = :'o1'),
  '130000/12000/142000', 'el total lo calcula la base de datos: 2 × 50.000 + 30.000 + envío 12.000');
select is((select available from public.get_product_availability(array[:'p1'::uuid])), 0,
  'las unidades del pedido quedan apartadas');
reset role;

set local role authenticated;
set local request.jwt.claims to :'cliente2';
select throws_ok(pg_temp.order_args(format('[{"product_id":"%s","quantity":1}]', :'p1')), 'P0001', 'out_of_stock',
  'otra clienta no puede comprar unidades apartadas');
select is((select count(*)::integer from public.orders where id = :'o1'), 0,
  'otra clienta no ve el pedido');
reset role;

set local role authenticated;
set local request.jwt.claims to :'cliente1';
-- Un pedido nuevo de la misma clienta cancela el anterior y suelta sus unidades.
select public.create_order(format('[{"product_id":"%s","quantity":1}]', :'p2')::jsonb,
  'pickup', 'Ana Prueba', '3001234567', null, null, null, :rv) as o2 \gset
select is((select status::text from public.orders where id = :'o1'), 'cancelled',
  'el pedido sin pagar anterior se cancela');
select is((select available from public.get_product_availability(array[:'p1'::uuid])), 2,
  'y sus unidades vuelven a estar disponibles');
select is((select shipping_cop || '/' || total_cop from public.orders where id = :'o2'), '0/30000',
  'recoger en el estudio no cobra envío');

select reference as ref2, amount_in_cents as amt2 from public.prepare_order_payment(:'o2') \gset
select matches(:'ref2'::text, '^PED-[0-9A-F]{16}$', 'la referencia del pago es única y empieza por PED-');
select is(:amt2::bigint, 3000000::bigint, 'en la pasarela se cobra el total');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Pagos
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(format('select public.apply_order_payment_event(%L,%L,%L,%L,%L,%s,%L)',
  'webhook', 'k-falso', :'ref2', 'tx-falso', 'APPROVED', :amt2, 'COP'), '42501', null,
  'clienta: no puede aplicar pagos');
reset role;

set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:tx-o2-bad:APPROVED', :'ref2', 'tx-o2-bad',
  'APPROVED', 100, 'COP'), 'amount_mismatch', 'un monto distinto no paga el pedido');
reset role;
select is((select status::text from public.orders where id = :'o2'), 'pending_payment',
  'verificación: el pedido sigue sin pagar');

-- El intento con monto errado quedó en error; se crea uno nuevo.
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select reference as ref2b from public.prepare_order_payment(:'o2') \gset
reset role;
set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:tx-o2:APPROVED', :'ref2b', 'tx-o2',
  'APPROVED', :amt2, 'COP'), 'paid', 'pago aprobado: pedido pagado');
select is(public.apply_order_payment_event('webhook', 'wompi:tx-o2:APPROVED', :'ref2b', 'tx-o2',
  'APPROVED', :amt2, 'COP'), 'duplicate', 'el mismo aviso no se aplica dos veces');
reset role;
select is((select stock from public.products where id = :'p2'), 9, 'al pagar se descuenta el stock');

-- Pago tardío con unidades disponibles: se vende.
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select public.create_order(format('[{"product_id":"%s","quantity":1}]', :'p1')::jsonb,
  'pickup', 'Bea Prueba', '3007654321', null, null, null, :rv) as o3 \gset
select reference as ref3, amount_in_cents as amt3 from public.prepare_order_payment(:'o3') \gset
reset role;
update public.orders set hold_expires_at = now() - interval '1 minute' where id = :'o3';
set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:tx-o3:APPROVED', :'ref3', 'tx-o3',
  'APPROVED', :amt3, 'COP'), 'paid_late', 'pago tardío con unidades disponibles: se vende');
reset role;
select is((select stock from public.products where id = :'p1'), 1, 'y se descuenta del stock');

-- Pago tardío sin unidades: queda por revisar y el stock no baja de cero.
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select public.create_order(format('[{"product_id":"%s","quantity":1}]', :'p1')::jsonb,
  'pickup', 'Bea Prueba', '3007654321', null, null, null, :rv) as o4 \gset
select reference as ref4, amount_in_cents as amt4 from public.prepare_order_payment(:'o4') \gset
reset role;
update public.orders set hold_expires_at = now() - interval '1 minute' where id = :'o4';
update public.products set stock = 0 where id = :'p1';
set local role service_role;
select is(public.apply_order_payment_event('webhook', 'wompi:tx-o4:APPROVED', :'ref4', 'tx-o4',
  'APPROVED', :amt4, 'COP'), 'paid_out_of_stock', 'pago tardío sin unidades: no se vende');
reset role;
select is((select status::text || '/' || needs_review from public.orders where id = :'o4'), 'expired/true',
  'el pedido queda vencido y por revisar (devolver el dinero)');
select is((select stock from public.products where id = :'p1'), 0, 'el stock nunca queda negativo');

-- ---------------------------------------------------------------------------
-- 5. Cancelar y avanzar pedidos
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(format('select public.cancel_my_order(%L)', :'o2'), 'P0001', 'not_cancellable',
  'la clienta no puede cancelar un pedido pagado');
select throws_ok(format('select public.set_order_status(%L, %L)', :'o2', 'ready'), '42501', null,
  'la clienta no puede cambiar el estado');
reset role;

set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select throws_ok(format('select public.set_order_status(%L, %L)', :'o2', 'shipped'), 'P0001', 'invalid_transition',
  'un pedido para recoger no se marca como enviado');
select lives_ok(format('select public.set_order_status(%L, %L)', :'o2', 'ready'), 'admin: listo para recoger');
select lives_ok(format('select public.set_order_status(%L, %L)', :'o2', 'delivered'), 'admin: entregado');
select throws_ok(format('select public.set_order_status(%L, %L)', :'o2', 'cancelled'), 'P0001', 'invalid_transition',
  'un pedido entregado ya no se cancela');
select lives_ok(format('select public.set_order_status(%L, %L)', :'o3', 'cancelled'),
  'admin: cancela un pedido pagado');
reset role;
select is((select stock from public.products where id = :'p1'), 1,
  'al cancelar un pedido pagado las unidades vuelven al stock');
select is((select needs_review from public.orders where id = :'o3'), true,
  'el pedido pagado y cancelado queda por revisar (devolver el dinero)');

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(format('select public.mark_order_reviewed(%L)', :'o3'), '42501', null,
  'la clienta no puede marcar un pedido como revisado');
reset role;
set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select lives_ok(format('select public.mark_order_reviewed(%L)', :'o3'), 'admin: marca el pedido como revisado');
reset role;
select is((select needs_review from public.orders where id = :'o3'), false, 'ya no queda por revisar');

select * from finish();
rollback;
