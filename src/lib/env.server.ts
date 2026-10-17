import "server-only";
import { z } from "zod";

/**
 * Variables SECRETAS: solo existen en el servidor.
 * "server-only" hace fallar la compilación si alguien importa este archivo
 * desde un componente que corre en el navegador.
 */
const serverEnvSchema = z.object({
  // Llave maestra de Supabase: salta las reglas RLS. Solo para tareas internas
  // muy acotadas (por ahora, el límite de intentos).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local"),
});

let cached: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (!cached) {
    const result = serverEnvSchema.safeParse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    if (!result.success) {
      throw new Error(result.error.issues.map((issue) => issue.message).join("\n"));
    }
    cached = result.data;
  }
  return cached;
}
