-- ============================================================================
-- Pruebas del vencimiento del saldo a favor (pgTAP). Ejecutar con:
--   npx supabase test db
--
-- Política de la prueba: anticipo 50 %, cancelar sin penalidad con 48 h,
-- saldo válido 15 días. Servicio social: $180.000 → anticipo $90.000.
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into public.business_rules (
  deposit_percent, reschedule_window_hours, reschedule_penalty_percent, free_cancellation_hours,
  preorder_deposit_percent, preorder_delivery_days, buffer_minutes, booking_hold_minutes,
  min_booking_notice_hours, max_booking_days_ahead, credit_validity_days, change_reason
) values (50, 24, 30, 48, 50, 15, 15, 10, 12, 90, 15, 'Prueba pgTAP saldo');

select max(version) as rv from public.business_rules \gset
select id as svc from public.services where name = 'Maquillaje social' \gset

select
  ((d10 + time '11:00') at time zone 'America/Bogota')::text as t_new1,
  ((d12 + time '14:00') at time zone 'America/Bogota')::text as t_new2,
  ((d14 + time '15:00') at time zone 'America/Bogota')::text as t_new3,
  ((d18 + time '10:00') at time zone 'America/Bogota')::text as t_a1,
  ((d20 + time '10:00') at time zone 'America/Bogota')::text as t_a2
from (
  select
    t + 10 + (extract(dow from t + 10) = 0)::int as d10,
    t + 12 + (extract(dow from t + 12) = 0)::int as d12,
    t + 14 + (extract(dow from t + 14) = 0)::int as d14,
    t + 18 + (extract(dow from t + 18) = 0)::int as d18,
    t + 20 + (extract(dow from t + 20) = 0)::int as d20
  from (select (now() at time zone 'America/Bogota')::date as t) x
) y \gset

\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set cliente1_id '22222222-2222-2222-2222-222222222222'

-- a1: cita confirmada dentro de 18 días con la política vigente.
-- a2: cita confirmada dentro de 20 días con la misma política (se cancela después
--     de que cambie la política, para ver que vale la aceptada).
create temporary table t_appts (name text, id uuid);
grant select on t_appts to authenticated, service_role;
with rows (name, starts_at) as (values ('a1', :'t_a1'::timestamptz), ('a2', :'t_a2'::timestamptz)),
inserted as (
  insert into public.appointments (
    customer_id, service_id, service_name, duration_minutes, price_cop, rules_version,
    deposit_percent, deposit_cop, policy_accepted_at, starts_at, ends_at, blocked_until,
    status, confirmed_at, customer_notes
  )
  select :'cliente1_id', :'svc', 'Maquillaje social', 90, 180000, :rv,
         50, 90000, now(), starts_at, starts_at + interval '90 minutes', starts_at + interval '105 minutes',
         'confirmed', now(), name
  from rows
  returning id, customer_notes
)
insert into t_appts select customer_notes, id from inserted;
select id as a1 from t_appts where name = 'a1' \gset
select id as a2 from t_appts where name = 'a2' \gset

-- ---------------------------------------------------------------------------
-- 1. El saldo de una cancelación vence a los 15 días
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is(public.cancel_appointment(:'a1'), 90000, 'cancelar con anticipación: 90.000 a favor');
reset role;

select id as lot_a1 from public.credit_movements where appointment_id = :'a1' and lot_id is null \gset
select is((select expires_at from public.credit_movements where id = :lot_a1), now() + interval '15 days',
  'el abono vence 15 días después de generarse');

-- Dos abonos más, puestos a mano: uno que vence en 2 días y otro ya vencido.
insert into public.credit_movements (customer_id, amount_cop, reason, expires_at, created_at)
values (:'cliente1_id', 20000, 'cancellation', now() + interval '2 days', now() - interval '13 days'),
       (:'cliente1_id', 50000, 'cancellation', now() - interval '1 day', now() - interval '16 days');
select id as lot_old from public.credit_movements
where customer_id = :'cliente1_id' and amount_cop = 20000 and lot_id is null \gset
select id as lot_expired from public.credit_movements
where customer_id = :'cliente1_id' and amount_cop = 50000 and lot_id is null \gset

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is(public.my_credit_balance(), 110000, 'el saldo vencido no cuenta: 90.000 + 20.000');
select is((select count(*)::integer from public.my_credit_lots()), 2, 'la clienta ve sus dos saldos vigentes');
select is((select remaining_cop from public.my_credit_lots() limit 1), 20000,
  'primero aparece el saldo que vence antes');
select throws_ok($$select public.expire_credits()$$, '42501', null,
  'clienta: no puede correr la tarea de vencimiento');

-- ---------------------------------------------------------------------------
-- 2. Se usa primero el saldo que vence antes
-- ---------------------------------------------------------------------------
select public.create_booking(:'svc', :'t_new1', :rv) as b1 \gset
select is((select status::text || '/' || credit_applied_cop from public.appointments where id = :'b1'),
  'confirmed/90000', 'reserva nueva: el saldo cubre el anticipo');
reset role;

select is((select remaining_cop from private.credit_lots(:'cliente1_id') where lot_id = :lot_old), 0,
  'el saldo que vencía antes se usó completo');
select is((select remaining_cop from private.credit_lots(:'cliente1_id') where lot_id = :lot_a1), 20000,
  'del saldo más nuevo se usó solo lo que faltaba (70.000)');
select is((select amount_cop from public.credit_movements where lot_id = :lot_expired and reason = 'expired'),
  -50000, 'el saldo vencido no se usó: al reservar quedó registrado como «vencido»');

-- ---------------------------------------------------------------------------
-- 3. Si una reserva sin pagar se libera, el saldo vuelve con su fecha original
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select public.create_booking(:'svc', :'t_new2', :rv) as b2 \gset
select is((select status::text || '/' || credit_applied_cop from public.appointments where id = :'b2'),
  'pending_payment/20000', 'reserva parcial: usa los 20.000 que quedaban');
select is(public.my_credit_balance(), 0, 'saldo en cero');
reset role;

update public.appointments set hold_expires_at = now() - interval '1 minute' where id = :'b2';
select is(private.expire_stale_holds(), 1, 'vence la reserva sin pagar');
select is((select remaining_cop from private.credit_lots(:'cliente1_id') where lot_id = :lot_a1), 20000,
  'el saldo volvió al mismo abono');
select is((select expires_at from public.credit_movements where id = :lot_a1), now() + interval '15 days',
  'y conserva su fecha de vencimiento original');

-- ---------------------------------------------------------------------------
-- 4. La tarea diaria registra el saldo vencido
-- ---------------------------------------------------------------------------
insert into public.credit_movements (customer_id, amount_cop, reason, expires_at, created_at)
values (:'cliente1_id', 10000, 'late_cancellation', now() - interval '1 hour', now() - interval '15 days');
select id as lot_expired2 from public.credit_movements
where customer_id = :'cliente1_id' and amount_cop = 10000 and lot_id is null \gset

set local role service_role;
select is(public.expire_credits(), 1, 'tarea diaria: registra un saldo vencido');
select is(public.expire_credits(), 0, 'si se corre otra vez, no lo registra dos veces');
reset role;
select is((select amount_cop from public.credit_movements where lot_id = :lot_expired2 and reason = 'expired'),
  -10000, 'el movimiento «vencido» descuenta lo que quedaba');

-- ---------------------------------------------------------------------------
-- 5. Vale la vigencia de la política que la clienta aceptó
-- ---------------------------------------------------------------------------
insert into public.business_rules (
  deposit_percent, reschedule_window_hours, reschedule_penalty_percent, free_cancellation_hours,
  preorder_deposit_percent, preorder_delivery_days, buffer_minutes, booking_hold_minutes,
  min_booking_notice_hours, max_booking_days_ahead, credit_validity_days, change_reason
) values (50, 24, 30, 48, 50, 15, 15, 10, 12, 90, 5, 'Prueba pgTAP: vigencia de 5 días');

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is(public.cancel_appointment(:'a2'), 90000, 'cancelar otra cita aceptada con la política anterior');
reset role;
select is((select expires_at from public.credit_movements where appointment_id = :'a2' and lot_id is null),
  now() + interval '15 days', 'el abono vence según la política aceptada (15 días), no la nueva (5)');

select * from finish();
rollback;
