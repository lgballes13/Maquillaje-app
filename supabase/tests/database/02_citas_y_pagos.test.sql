-- ============================================================================
-- Pruebas de base de datos de la Fase 2: servicios, citas y pagos (pgTAP).
-- Ejecutar con:  npx supabase test db
--
-- Verifican lo más delicado: que dos citas nunca se crucen, que el anticipo lo
-- calcule la base de datos, que solo el servidor confirme pagos y que un
-- evento repetido de la pasarela no se aplique dos veces.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- Datos de apoyo: un día hábil dentro de 3 o 4 días y horas de ese día (hora de Bogotá).
select
  ((d + time '10:00') at time zone 'America/Bogota')::text as t_a,        -- cita 1: 10:00–11:30 (+15 min)
  ((d + time '11:00') at time zone 'America/Bogota')::text as t_overlap,  -- se cruza con la cita 1
  ((d + time '11:35') at time zone 'America/Bogota')::text as t_buffer,   -- cae en la preparación
  ((d + time '11:45') at time zone 'America/Bogota')::text as t_after,    -- justo después: libre
  ((d + time '06:00') at time zone 'America/Bogota')::text as t_early,    -- antes de abrir
  ((d + time '10:07') at time zone 'America/Bogota')::text as t_odd,      -- minuto no válido
  ((d + time '14:00') at time zone 'America/Bogota')::text as t_block_start,
  ((d + time '17:00') at time zone 'America/Bogota')::text as t_block_end,
  ((d + time '15:00') at time zone 'America/Bogota')::text as t_blocked,
  ((d + time '17:00') at time zone 'America/Bogota')::text as t_c,
  ((d + time '17:30') at time zone 'America/Bogota')::text as t_d,
  ((d + time '00:00') at time zone 'America/Bogota')::text as t_day_start,
  ((d + time '23:59') at time zone 'America/Bogota')::text as t_day_end,
  (date_trunc('hour', now()) + interval '2 hours')::text as t_soon
from (
  select (now() at time zone 'America/Bogota')::date
         + case when extract(dow from (now() at time zone 'America/Bogota')::date + 3) = 0 then 4 else 3 end as d
) x \gset

select id as svc from public.services where name = 'Maquillaje social' \gset
select max(version) as rv from public.business_rules \gset

\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set cliente2 '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'

-- ---------------------------------------------------------------------------
-- 1. Visitante sin sesión
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is((select count(*) from public.services), 3::bigint, 'anon: ve los 3 servicios activos');
select lives_ok(format('select * from public.get_busy_periods(%L, %L)', :'t_day_start', :'t_day_end'),
  'anon: puede consultar horarios ocupados');
select throws_ok($$select public.get_busy_periods(now(), now() + interval '60 days')$$, '22023', null,
  'anon: no puede consultar rangos de más de 31 días');
select throws_ok('select * from public.appointments', '42501', null, 'anon: no puede leer citas');
select throws_ok('select * from public.blocked_periods', '42501', null, 'anon: no puede leer bloqueos');
select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_a', :rv), '42501', null,
  'anon: no puede reservar');

reset role;

-- ---------------------------------------------------------------------------
-- 2. Clienta 1 reserva
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';

select public.create_booking(:'svc', :'t_a', :rv, 'Evento a las 7 p. m.') as appt1 \gset
select isnt(:'appt1'::text, null::text, 'clienta 1: reserva un horario libre');
select is((select status::text from public.appointments where id = :'appt1'), 'pending_payment',
  'clienta 1: la cita queda apartada mientras paga');
select is((select deposit_cop from public.appointments where id = :'appt1'), 90000,
  'clienta 1: el anticipo lo calcula la base de datos (50 % de 180.000)');
select ok((select hold_expires_at between now() + interval '9 minutes' and now() + interval '11 minutes'
           from public.appointments where id = :'appt1'),
  'clienta 1: el horario se aparta 10 minutos');

select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_a', :rv - 1), 'P0001',
  'policy_changed', 'clienta 1: no puede reservar con una política vieja');
select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_early', :rv), 'P0001',
  'outside_business_hours', 'clienta 1: no puede reservar antes de abrir');
select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_soon', :rv), 'P0001',
  'outside_booking_window', 'clienta 1: no puede reservar sin la anticipación mínima');
select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_odd', :rv), 'P0001',
  'invalid_start', 'clienta 1: la hora debe ser múltiplo de 5 minutos');
select throws_ok(format('select public.create_booking(%L, %L, %s)', gen_random_uuid(), :'t_c', :rv), 'P0001',
  'service_unavailable', 'clienta 1: no puede reservar un servicio que no existe');

select throws_ok(
  format($$insert into public.appointments (customer_id, service_id, service_name, duration_minutes, price_cop,
    rules_version, deposit_percent, deposit_cop, policy_accepted_at, starts_at, ends_at, blocked_until, status)
    values (auth.uid(), %L, 'x', 60, 1000, %s, 0, 0, now(), %L, %L, %L, 'confirmed')$$,
    :'svc', :rv, :'t_c', :'t_d', :'t_d'),
  '42501', null, 'clienta 1: no puede crear citas directo en la tabla (sin pagar)');
select throws_ok(format($$update public.appointments set status = 'confirmed' where id = %L$$, :'appt1'),
  '42501', null, 'clienta 1: no puede confirmar su cita a mano');
select throws_ok($$select public.apply_payment_event('webhook', 'x', 'x', 'x', 'APPROVED', 1, 'COP')$$,
  '42501', null, 'clienta 1: no puede aplicar pagos');
select throws_ok($$insert into public.services (name, duration_minutes, price_cop) values ('Gratis', 60, 1000)$$,
  '42501', null, 'clienta 1: no puede crear servicios');

select reference as ref1, amount_in_cents as amount1 from public.prepare_appointment_payment(:'appt1') \gset
select is(:'amount1'::bigint, 9000000::bigint, 'clienta 1: el pago es el anticipo en centavos');
select is((select reference from public.prepare_appointment_payment(:'appt1')), :'ref1',
  'clienta 1: volver a la página de pago reutiliza el mismo intento');

reset role;

-- ---------------------------------------------------------------------------
-- 3. Clienta 2 intenta cruzarse
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente2';

select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_overlap', :rv), 'P0001',
  'slot_unavailable', 'clienta 2: no puede reservar un horario que se cruza');
select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_buffer', :rv), 'P0001',
  'slot_unavailable', 'clienta 2: tampoco en el tiempo de preparación entre citas');
select public.create_booking(:'svc', :'t_after', :rv) as appt2 \gset
select isnt(:'appt2'::text, null::text, 'clienta 2: sí puede reservar justo después de la preparación');
select is((select count(*) from public.appointments), 1::bigint, 'clienta 2: solo ve su propia cita');
select throws_ok(format('select * from public.prepare_appointment_payment(%L)', :'appt1'), 'P0001', 'not_found',
  'clienta 2: no puede pagar ni ver la cita de otra');
select is((select count(*) from public.blocked_periods), 0::bigint, 'clienta 2: no ve los bloqueos');
select is((select count(*) from public.get_busy_periods(:'t_day_start', :'t_day_end')), 2::bigint,
  'clienta 2: ve 2 horarios ocupados, sin datos de nadie');

select reference as ref2 from public.prepare_appointment_payment(:'appt2') \gset

reset role;

-- ---------------------------------------------------------------------------
-- 4. Admin con 2FA: servicios y bloqueos
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'admin2fa';

select lives_ok($$insert into public.services (name, duration_minutes, price_cop) values ('Peinado', 60, 90000)$$,
  'admin: crea un servicio');
select lives_ok(format($$insert into public.blocked_periods (starts_at, ends_at, reason) values (%L, %L, 'Cita médica')$$,
  :'t_block_start', :'t_block_end'), 'admin: bloquea una franja');
select is((select count(*) from public.appointments), 2::bigint, 'admin: ve todas las citas');

reset role;

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(format('select public.create_booking(%L, %L, %s)', :'svc', :'t_blocked', :rv), 'P0001',
  'slot_unavailable', 'clienta 1: no puede reservar en una franja bloqueada');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Servidor (service_role) aplica eventos de la pasarela
-- ---------------------------------------------------------------------------
set local role service_role;

select is(public.apply_payment_event('webhook', 'evt-1', :'ref1', 'tx-1', 'APPROVED', 9000000, 'COP', 'CARD'),
  'confirmed', 'pago aprobado: confirma la cita');
select is(public.apply_payment_event('webhook', 'evt-1', :'ref1', 'tx-1', 'APPROVED', 9000000, 'COP', 'CARD'),
  'duplicate', 'evento repetido: se reconoce y no se aplica dos veces');
select is(public.apply_payment_event('webhook', 'evt-2', :'ref1', 'tx-1', 'PENDING', 9000000, 'COP', 'CARD'),
  'ignored_final', 'evento viejo que llega tarde: no hace retroceder un pago aprobado');
select is(public.apply_payment_event('webhook', 'evt-3', 'NO-EXISTE', 'tx-9', 'APPROVED', 100, 'COP'),
  'unknown_reference', 'referencia desconocida: no confirma nada');
select is(public.apply_payment_event('webhook', 'evt-4', :'ref2', 'tx-2', 'APPROVED', 100, 'COP'),
  'amount_mismatch', 'monto distinto al anticipo: no confirma la cita');

reset role;

select is((select status::text from public.appointments where id = :'appt1'), 'confirmed',
  'verificación: la cita 1 quedó confirmada');
select is((select status::text || '/' || needs_review::text from public.appointments where id = :'appt2'),
  'pending_payment/true', 'verificación: la cita 2 sigue sin pagar y queda marcada para revisión');

-- Pago tardío: el horario de la cita 2 venció y otra clienta lo tomó.
update public.appointments set hold_expires_at = now() - interval '1 minute' where id = :'appt2';
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select public.create_booking(:'svc', :'t_after', :rv) as appt3 \gset
select isnt(:'appt3'::text, null::text, 'clienta 1: puede tomar un horario cuyo tiempo para pagar venció');
select public.create_booking(:'svc', :'t_c', :rv) as appt4 \gset
select is((select status::text from public.appointments where id = :'appt3'), 'cancelled',
  'clienta 1: empezar otra reserva libera el horario que tenía apartado');
reset role;

insert into public.payments (appointment_id, reference, amount_in_cents)
values (:'appt2', 'CITA-TARDE', 9000000);
set local role service_role;
select is(public.apply_payment_event('webhook', 'evt-5', 'CITA-TARDE', 'tx-5', 'APPROVED', 9000000, 'COP'),
  'confirmed_late', 'pago tardío con el horario libre otra vez: se confirma');
reset role;

select ok((select count(*) from public.audit_log where table_name = 'appointments') >= 6,
  'auditoría: cada cambio de una cita queda registrado');
select ok((select count(*) from public.audit_log where table_name = 'payments') >= 3,
  'auditoría: cada cambio de un pago queda registrado');

select * from finish();
rollback;
