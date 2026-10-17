-- ============================================================================
-- Fase 3 · Migración 1: estados nuevos de la cita
-- ----------------------------------------------------------------------------
-- Va en un archivo aparte porque Postgres no deja usar un valor nuevo de un
-- enum en la misma transacción en que se crea.
-- ============================================================================

alter type public.appointment_status add value if not exists 'completed';   -- asistió
alter type public.appointment_status add value if not exists 'no_show';     -- no asistió
alter type public.appointment_status add value if not exists 'rescheduled'; -- se cambió por otra cita
