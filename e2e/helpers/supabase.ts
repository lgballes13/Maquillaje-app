import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Utilidades de prueba que usan la llave service_role de Supabase LOCAL.
 * Nunca se usan contra producción: las variables vienen de `supabase status`.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  if (!/127\.0\.0\.1|localhost/.test(url))
    throw new Error("Las pruebas E2E solo corren contra Supabase local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const TEST_PASSWORD = "ClaveDePrueba123";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@demo.example`;
}

/** Crea un usuario confirmado. Con admin=true le asigna el rol de administrador. */
export async function createTestUser({ admin = false, name = "Persona de Prueba" } = {}) {
  const email = uniqueEmail(admin ? "admin" : "cliente");
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      privacy_accepted: true,
      privacy_policy_version: "2026-10-16",
    },
  });
  if (error || !data.user) throw error ?? new Error("No se creó el usuario");
  if (admin) {
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user.id, role: "admin" });
    if (roleError) throw roleError;
  }
  return { id: data.user.id, email, password: TEST_PASSWORD };
}
