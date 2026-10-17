-- ============================================================================
-- Fase 5 · Preventa: valores nuevos de enums.
-- Van en su propia migración porque un valor nuevo de un enum no se puede usar
-- en la misma transacción en que se crea.
-- ============================================================================
alter type public.order_status add value if not exists 'deposit_paid' after 'pending_payment';
alter type public.order_status add value if not exists 'awaiting_balance' after 'deposit_paid';

alter type public.credit_reason add value if not exists 'applied_to_order';
alter type public.credit_reason add value if not exists 'preorder_unpaid';
