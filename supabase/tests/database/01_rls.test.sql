-- ============================================================================
-- Pruebas de seguridad de la base de datos (pgTAP).
-- Ejecutar con:  npx supabase test db
--
-- Cada prueba "se hace pasar" por un tipo de usuario cambiando el rol de
-- Postgres y los datos del token (JWT) y verifica qué puede ver o hacer.
-- Todo corre dentro de una transacción que se deshace al final (rollback).
-- Usa los usuarios de supabase/seed.sql.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

-- Identificadores de los usuarios del seed
\set admin_id   '''11111111-1111-1111-1111-111111111111'''
\set cliente_id '''22222222-2222-2222-2222-222222222222'''
\set cliente2_id '''33333333-3333-3333-3333-333333333333'''

-- ---------------------------------------------------------------------------
-- 1. Visitante sin sesión (anon)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok('select * from public.profiles', '42501', null, 'anon: no puede leer perfiles');
select ok((select count(*) from public.business_rules) >= 1, 'anon: puede leer las reglas del negocio');
select is((select count(*) from public.business_hours), 7::bigint, 'anon: puede leer el horario (7 días)');
select throws_ok(
  $$insert into public.business_rules (deposit_percent, reschedule_window_hours, reschedule_penalty_percent,
    free_cancellation_hours, preorder_deposit_percent, preorder_delivery_days, buffer_minutes,
    booking_hold_minutes, min_booking_notice_hours, max_booking_days_ahead)
    values (10, 24, 30, 48, 50, 15, 15, 10, 12, 90)$$,
  '42501', null, 'anon: no puede crear reglas');
select throws_ok($$select public.consume_rate_limit('x', 5, 60)$$, '42501', null,
  'anon: no puede usar el limitador de intentos');

reset role;

-- ---------------------------------------------------------------------------
-- 2. Cliente con sesión normal (aal1)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';

select is((select count(*) from public.profiles), 1::bigint, 'cliente: solo ve un perfil');
select is((select id::text from public.profiles), :cliente_id, 'cliente: el perfil que ve es el suyo');
select lives_ok($$update public.profiles set full_name = 'Cliente Editada' where id = auth.uid()$$,
  'cliente: puede editar su nombre');
select lives_ok(
  format($$update public.profiles set full_name = 'Hackeado' where id = %L$$, :cliente2_id),
  'cliente: intentar editar otro perfil no da error pero no cambia nada');
select throws_ok($$update public.profiles set privacy_accepted_at = now() - interval '1 year' where id = auth.uid()$$,
  '42501', null, 'cliente: no puede alterar la fecha de autorización de datos');
select throws_ok(format($$insert into public.user_roles (user_id, role) values (%L, 'admin')$$, :cliente_id),
  '42501', null, 'cliente: no puede darse el rol de admin');
select throws_ok(
  $$insert into public.business_rules (deposit_percent, reschedule_window_hours, reschedule_penalty_percent,
    free_cancellation_hours, preorder_deposit_percent, preorder_delivery_days, buffer_minutes,
    booking_hold_minutes, min_booking_notice_hours, max_booking_days_ahead)
    values (0, 24, 30, 48, 50, 15, 15, 10, 12, 90)$$,
  '42501', null, 'cliente: no puede crear reglas');
select is((select count(*) from public.audit_log), 0::bigint, 'cliente: no ve la auditoría');
select lives_ok($$update public.business_hours set is_open = false, opens_at = null, closes_at = null where weekday = 1$$,
  'cliente: intentar cambiar el horario no da error pero no cambia nada');
select is((select count(*) from public.user_roles), 0::bigint, 'cliente: no ve roles de otros');

reset role;

select is((select full_name from public.profiles where id = :cliente2_id), 'Cliente Dos',
  'verificación: el perfil de la otra clienta sigue intacto');
select is((select is_open from public.business_hours where weekday = 1), true,
  'verificación: el horario del lunes sigue intacto');

-- ---------------------------------------------------------------------------
-- 3. Admin SIN segundo factor (aal1)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';

select is(public.is_admin(), false, 'admin sin 2FA: no cuenta como admin');
select is(public.has_role('admin'), true, 'admin sin 2FA: sí tiene el rol');
select throws_ok(
  $$insert into public.business_rules (deposit_percent, reschedule_window_hours, reschedule_penalty_percent,
    free_cancellation_hours, preorder_deposit_percent, preorder_delivery_days, buffer_minutes,
    booking_hold_minutes, min_booking_notice_hours, max_booking_days_ahead)
    values (40, 24, 30, 48, 50, 15, 15, 10, 12, 90)$$,
  '42501', null, 'admin sin 2FA: no puede cambiar reglas');
select is((select count(*) from public.profiles), 1::bigint, 'admin sin 2FA: solo ve su propio perfil');

reset role;

-- ---------------------------------------------------------------------------
-- 4. Admin CON segundo factor (aal2)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}';

select is(public.is_admin(), true, 'admin con 2FA: cuenta como admin');
select is((select count(*) from public.profiles), 3::bigint, 'admin con 2FA: ve todos los perfiles');
select lives_ok(
  $$insert into public.business_rules (deposit_percent, reschedule_window_hours, reschedule_penalty_percent,
    free_cancellation_hours, preorder_deposit_percent, preorder_delivery_days, buffer_minutes,
    booking_hold_minutes, min_booking_notice_hours, max_booking_days_ahead, change_reason)
    values (40, 24, 30, 48, 50, 15, 15, 10, 12, 90, 'Prueba')$$,
  'admin con 2FA: puede crear una versión nueva de las reglas');
select is((select created_by::text from public.business_rules order by version desc limit 1), :admin_id,
  'admin con 2FA: la versión nueva registra quién la creó');
select throws_ok($$update public.business_rules set deposit_percent = 1$$, '42501', null,
  'admin con 2FA: las versiones de reglas no se pueden editar');
select throws_ok($$delete from public.business_rules$$, '42501', null,
  'admin con 2FA: las versiones de reglas no se pueden borrar');
select lives_ok($$update public.business_hours set opens_at = '10:00' where weekday = 2$$,
  'admin con 2FA: puede cambiar el horario');
select throws_ok($$update public.business_hours set opens_at = '20:00', closes_at = '08:00' where weekday = 3$$,
  '23514', null, 'admin con 2FA: no puede guardar un horario que cierra antes de abrir');
select throws_ok(
  $$insert into public.business_rules (deposit_percent, reschedule_window_hours, reschedule_penalty_percent,
    free_cancellation_hours, preorder_deposit_percent, preorder_delivery_days, buffer_minutes,
    booking_hold_minutes, min_booking_notice_hours, max_booking_days_ahead)
    values (150, 24, 30, 48, 50, 15, 15, 10, 12, 90)$$,
  '23514', null, 'admin con 2FA: no puede guardar un porcentaje mayor a 100');
select ok(exists(
  select 1 from public.audit_log
  where table_name = 'business_rules' and action = 'INSERT' and actor_id::text = :admin_id
), 'auditoría: registra que el admin creó una versión de reglas');
select throws_ok($$delete from public.audit_log$$, '42501', null,
  'auditoría: ni el admin puede borrar registros');

reset role;

-- ---------------------------------------------------------------------------
-- 5. Registro (Ley 1581) y límite de intentos
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'sin-consentimiento@demo.example', '{"full_name":"Sin Consentimiento"}')$$,
  '23514', null, 'registro: sin autorización de datos no se crea la cuenta');

insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'nueva@demo.example',
  '{"full_name":"Nueva Cliente","privacy_accepted":true,"privacy_policy_version":"2026-10-16"}');
select ok(
  (select privacy_accepted_at > now() - interval '1 minute'
     from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  'registro: con autorización se crea el perfil con la fecha del servidor');

set local role service_role;
select is(
  array[public.consume_rate_limit('prueba', 2, 60), public.consume_rate_limit('prueba', 2, 60),
        public.consume_rate_limit('prueba', 2, 60)],
  array[true, true, false],
  'límite de intentos: el tercer intento dentro de la ventana se bloquea');
reset role;

select * from finish();
rollback;
