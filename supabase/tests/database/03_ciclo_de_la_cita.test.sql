-- ============================================================================
-- Pruebas de base de datos de la Fase 3: asistencia, cancelar, reprogramar y
-- saldo a favor (pgTAP). Ejecutar con:  npx supabase test db
--
-- Política usada (se crea aquí y se deshace al final):
--   anticipo 50 %, cancelar sin penalidad con 48 h, plazo para reprogramar tras
--   no asistir 24 h, penalidad 30 %.  Servicio social: $180.000 → anticipo $90.000,
--   penalidad $27.000, saldo tras penalidad $63.000.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

insert into public.business_rules (
  deposit_percent, reschedule_window_hours, reschedule_penalty_percent, free_cancellation_hours,
  preorder_deposit_percent, preorder_delivery_days, buffer_minutes, booking_hold_minutes,
  min_booking_notice_hours, max_booking_days_ahead, change_reason
) values (50, 24, 30, 48, 50, 15, 15, 10, 12, 90, 'Prueba pgTAP');

select max(version) as rv from public.business_rules \gset
select id as svc from public.services where name = 'Maquillaje social' \gset

-- Días hábiles (sin domingo) lejanos para las reservas nuevas.
select
  ((d10 + time '11:00') at time zone 'America/Bogota')::text as t_new1,
  ((d12 + time '14:00') at time zone 'America/Bogota')::text as t_new2,
  ((d14 + time '15:00') at time zone 'America/Bogota')::text as t_new3,
  ((d16 + time '16:00') at time zone 'America/Bogota')::text as t_new4,
  ((d18 + time '10:00') at time zone 'America/Bogota')::text as t_a1
from (
  select
    t + 10 + (extract(dow from t + 10) = 0)::int as d10,
    t + 12 + (extract(dow from t + 12) = 0)::int as d12,
    t + 14 + (extract(dow from t + 14) = 0)::int as d14,
    t + 16 + (extract(dow from t + 16) = 0)::int as d16,
    t + 18 + (extract(dow from t + 18) = 0)::int as d18
  from (select (now() at time zone 'America/Bogota')::date as t) x
) y \gset

\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set cliente2 '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'

-- Citas confirmadas de la clienta 1, creadas directo para fijar sus horas:
--   a1: dentro de 18 días (cancelación con anticipación)
--   a2: dentro de 20 horas (cancelación tardía)
--   a3: hace 5 horas (no asistió, dentro del plazo)
--   a4: hace 30 horas (no asistió, fuera del plazo)
--   a5: dentro de 23 horas (muy tarde para cambiar de horario)
create temporary table t_appts (name text, id uuid);
grant select on t_appts to authenticated, service_role;
with rows (name, starts_at) as (values
  ('a1', :'t_a1'::timestamptz),
  ('a2', date_trunc('hour', now()) + interval '20 hours'),
  ('a3', date_trunc('hour', now()) - interval '5 hours'),
  ('a4', date_trunc('hour', now()) - interval '30 hours'),
  ('a5', date_trunc('hour', now()) + interval '23 hours')
), inserted as (
  insert into public.appointments (
    customer_id, service_id, service_name, duration_minutes, price_cop, rules_version,
    deposit_percent, deposit_cop, policy_accepted_at, starts_at, ends_at, blocked_until,
    status, confirmed_at, customer_notes
  )
  select '22222222-2222-2222-2222-222222222222', :'svc', 'Maquillaje social', 90, 180000, :rv,
         50, 90000, now(), starts_at, starts_at + interval '90 minutes', starts_at + interval '105 minutes',
         'confirmed', now(), name
  from rows
  returning id, customer_notes
)
insert into t_appts select customer_notes, id from inserted;

select id as a1 from t_appts where name = 'a1' \gset
select id as a2 from t_appts where name = 'a2' \gset
select id as a3 from t_appts where name = 'a3' \gset
select id as a4 from t_appts where name = 'a4' \gset
select id as a5 from t_appts where name = 'a5' \gset

-- ---------------------------------------------------------------------------
-- 1. Asistencia (solo admin con 2FA)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select throws_ok(format('select public.mark_attendance(%L, false)', :'a3'), '42501', null,
  'clienta: no puede marcar asistencia');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
select throws_ok(format('select public.mark_attendance(%L, false)', :'a3'), '42501', null,
  'admin sin 2FA: no puede marcar asistencia');
reset role;

set local role authenticated;
set local request.jwt.claims to :'admin2fa';
select lives_ok(format('select public.mark_attendance(%L, false)', :'a3'), 'admin: marca «no asistió»');
select lives_ok(format('select public.mark_attendance(%L, false)', :'a4'), 'admin: marca otra «no asistió»');
select throws_ok(format('select public.mark_attendance(%L, true)', :'a1'), 'P0001', 'not_markable',
  'admin: no puede marcar asistencia de una cita futura');
select throws_ok(format('select public.mark_attendance(%L, true)', :'a3'), 'P0001', 'not_markable',
  'admin: no puede volver a marcar una cita ya marcada');
reset role;

select is((select status::text from public.appointments where id = :'a3'), 'no_show',
  'verificación: la cita quedó como «no asistió»');

-- ---------------------------------------------------------------------------
-- 2. Cancelar
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente2';
select throws_ok(format('select public.cancel_appointment(%L)', :'a1'), 'P0001', 'not_found',
  'clienta 2: no puede cancelar la cita de otra');
reset role;

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is(public.cancel_appointment(:'a1'), 90000, 'cancelar con anticipación: todo el anticipo queda a favor');
select is(public.cancel_appointment(:'a2'), 63000, 'cancelar tarde: se descuenta el 30 % y el resto queda a favor');
select is(public.my_credit_balance(), 153000, 'saldo a favor: 90.000 + 63.000');
select throws_ok(format('select public.cancel_appointment(%L)', :'a1'), 'P0001', 'not_cancellable',
  'no se puede cancelar dos veces');
select throws_ok(format('select public.cancel_appointment(%L)', :'a3'), 'P0001', 'not_cancellable',
  'no se puede cancelar una cita en la que no asistió');
select throws_ok($$insert into public.credit_movements (customer_id, amount_cop, reason)
  values (auth.uid(), 1000000, 'cancellation')$$, '42501', null, 'clienta: no puede darse saldo a mano');

-- ---------------------------------------------------------------------------
-- 3. El saldo se usa en la siguiente reserva
-- ---------------------------------------------------------------------------
select public.create_booking(:'svc', :'t_new1', :rv) as b1 \gset
select is((select status::text || '/' || credit_applied_cop from public.appointments where id = :'b1'),
  'confirmed/90000', 'reserva nueva: el saldo cubre todo el anticipo y queda confirmada sin pagar');
select is(public.my_credit_balance(), 63000, 'saldo después de usarlo: 63.000');

select public.create_booking(:'svc', :'t_new2', :rv) as b2 \gset
select is((select status::text || '/' || credit_applied_cop from public.appointments where id = :'b2'),
  'pending_payment/63000', 'reserva nueva: el saldo cubre una parte del anticipo');
select is((select amount_in_cents from public.prepare_appointment_payment(:'b2')), 2700000::bigint,
  'en la pasarela solo se paga lo que falta: 27.000');
select is(public.my_credit_balance(), 0, 'el saldo quedó en cero');
reset role;

-- La reserva sin pagar vence: el saldo vuelve.
update public.appointments set hold_expires_at = now() - interval '1 minute' where id = :'b2';
select is(private.expire_stale_holds(), 1, 'vence la reserva sin pagar');

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is(public.my_credit_balance(), 63000, 'al vencer, el saldo aplicado vuelve a la clienta');

-- ---------------------------------------------------------------------------
-- 4. Reprogramar
-- ---------------------------------------------------------------------------
select public.reschedule_appointment(:'a3', :'t_new2', :rv) as r1 \gset
select is((select rescheduled_from::text from public.appointments where id = :'r1'), :'a3',
  'no asistió y reprograma dentro del plazo: queda enlazada con la cita original');
-- 63.000 que tenía + 63.000 de la cita perdida = 126.000; la nueva usa 90.000.
select is(public.my_credit_balance(), 36000, 'reprogramar tras no asistir: se descuenta el 30 % y el resto se abona');
select throws_ok(format('select public.reschedule_appointment(%L, %L, %s)', :'a3', :'t_new3', :rv), 'P0001',
  'already_rescheduled', 'no se puede reprogramar dos veces la misma cita');
select throws_ok(format('select public.reschedule_appointment(%L, %L, %s)', :'a4', :'t_new3', :rv), 'P0001',
  'reschedule_window_closed', 'pasado el plazo tras no asistir, ya no se puede reprogramar');
select throws_ok(format('select public.reschedule_appointment(%L, %L, %s)', :'a5', :'t_new3', :rv), 'P0001',
  'too_late_to_reschedule', 'con menos de 48 horas no se puede cambiar de horario');

select public.reschedule_appointment(:'b1', :'t_new3', :rv) as r2 \gset
select is((select status::text from public.appointments where id = :'b1'), 'rescheduled',
  'cambiar de horario con anticipación: la cita original queda como reprogramada');
select is((select status::text from public.appointments where id = :'r2'), 'confirmed',
  'la cita nueva queda confirmada con el mismo anticipo');
select is(public.my_credit_balance(), 36000, 'cambiar de horario con anticipación no cuesta nada');

select throws_ok(format('select public.reschedule_appointment(%L, %L, %s)', :'r2', :'t_new1', :rv - 1), 'P0001',
  'policy_changed', 'si la política cambió, el cambio de horario se rechaza y la cita sigue igual');
select is((select status::text from public.appointments where id = :'r2'), 'confirmed',
  'verificación: tras el error, la cita sigue confirmada');
reset role;

select * from finish();
rollback;
