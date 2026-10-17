import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Cliente con la llave service_role: SALTA las reglas RLS.
 * Úsalo solo para tareas internas que nunca dependan de datos del usuario sin
 * validar. Hoy solo lo usa el límite de intentos.
 */
export function createAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient<Database>(url, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
