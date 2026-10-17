import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para el servidor (páginas, server actions, rutas).
 * Actúa EN NOMBRE del usuario que inició sesión, así que las reglas RLS aplican.
 */
export async function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies. No pasa nada:
          // el proxy (src/proxy.ts) ya renueva la sesión en cada petición.
        }
      },
    },
  });
}
