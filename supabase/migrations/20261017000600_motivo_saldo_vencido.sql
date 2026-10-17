-- ============================================================================
-- Saldo a favor que vence: nuevo motivo de movimiento.
-- Va en su propia migración porque un valor nuevo de un enum no se puede usar
-- en la misma transacción en que se crea.
-- ============================================================================
alter type public.credit_reason add value if not exists 'expired';
