import "server-only";
import { z } from "zod";

/**
 * Variables SECRETAS: solo existen en el servidor.
 * "server-only" hace fallar la compilación si alguien importa este archivo
 * desde un componente que corre en el navegador.
 */
const serverEnvSchema = z.object({
  // Llave maestra de Supabase: salta las reglas RLS. Solo para tareas internas
  // muy acotadas (límite de intentos y aplicar pagos ya verificados).
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

const wompiSecretsSchema = z.object({
  // Secreto de integridad: firma el monto y la referencia que se envían al checkout.
  WOMPI_INTEGRITY_SECRET: z.string().regex(/^(test|prod)_integrity_\w+$/),
  // Secreto de eventos: verifica que el webhook realmente viene de Wompi.
  WOMPI_EVENTS_SECRET: z.string().regex(/^(test|prod)_events_\w+$/),
});

export type WompiSecrets = z.infer<typeof wompiSecretsSchema>;

/** Secretos de Wompi, o null si no están configurados (los pagos quedan desactivados). */
export function getWompiSecrets(): WompiSecrets | null {
  const result = wompiSecretsSchema.safeParse({
    WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET,
    WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET,
  });
  if (!result.success) {
    if (process.env.WOMPI_INTEGRITY_SECRET || process.env.WOMPI_EVENTS_SECRET) {
      console.error("Los secretos de Wompi tienen un formato inválido (ver .env.example).");
    }
    return null;
  }
  return result.data;
}

const emailSchema = z.object({
  // Resend (producción). Si falta, en local se usa Mailpit y si tampoco hay, no se envía nada.
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  // Remitente, ej.: "Estudio de Maquillaje <citas@tudominio.com>" (dominio verificado en Resend).
  EMAIL_FROM: z.string().min(3).optional(),
  // Buzón de pruebas de Supabase local (solo desarrollo y CI).
  MAILPIT_URL: z.url().optional(),
});

export type EmailEnv = z.infer<typeof emailSchema>;

export function getEmailEnv(): EmailEnv {
  const result = emailSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    MAILPIT_URL: process.env.MAILPIT_URL || undefined,
  });
  if (!result.success) {
    console.error("Variables de correo inválidas (ver .env.example).");
    return {};
  }
  return result.data;
}

/** Secreto que Vercel Cron envía para llamar a las tareas programadas. */
export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}
