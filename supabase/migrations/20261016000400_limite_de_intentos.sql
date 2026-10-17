-- ============================================================================
-- Fase 1 · Migración 4: límite de intentos (rate limiting)
-- ----------------------------------------------------------------------------
-- Contador por "llave" (ej.: login + IP) en ventanas de tiempo fijas.
-- Solo el servidor de la app (service_role) puede usarlo: si los visitantes
-- pudieran llamarlo, podrían bloquear a otra persona a propósito.
-- ============================================================================

create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  if p_key is null or char_length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Parámetros inválidos para el límite de intentos';
  end if;

  insert into private.rate_limits as rl (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when rl.window_start < now() - v_window then 1 else rl.hits + 1 end,
        window_start = case when rl.window_start < now() - v_window then now() else rl.window_start end
  returning hits into v_hits;

  -- Limpieza ocasional (1 de cada 100 llamadas) de contadores viejos.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;

  -- true = puede continuar; false = superó el límite
  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
