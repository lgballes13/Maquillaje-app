import { z } from "zod";

/**
 * Variables de entorno PÚBLICAS (llegan al navegador).
 * Regla de oro: aquí NUNCA va un secreto. Los secretos (claves de pago,
 * service role de Supabase, etc.) se validan aparte, solo en el servidor.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url({ message: "NEXT_PUBLIC_SITE_URL debe ser una URL válida" }),
  NEXT_PUBLIC_BUSINESS_NAME: z.string().trim().min(1).max(80),
  // Número en formato internacional sin "+" ni espacios, ej.: 573001234567
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string()
    .regex(/^\d{8,15}$/, "NEXT_PUBLIC_WHATSAPP_NUMBER debe tener solo dígitos (8 a 15)")
    .optional(),
  // Datos del responsable para los textos legales (Ley 1581 y 1480). Si faltan,
  // las páginas legales muestran «[pendiente]» para que se note antes de publicar.
  NEXT_PUBLIC_CONTACT_EMAIL: z
    .email("NEXT_PUBLIC_CONTACT_EMAIL debe ser un correo válido")
    .optional(),
  NEXT_PUBLIC_BUSINESS_LEGAL_ID: z.string().trim().max(40).optional(),
  NEXT_PUBLIC_BUSINESS_ADDRESS: z.string().trim().max(160).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  // La clave "anon" o "publishable" es pública por diseño: la protección real
  // son las reglas RLS de la base de datos.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  // Llave pública de Wompi: pub_test_… (pruebas) o pub_prod_… (dinero real).
  NEXT_PUBLIC_WOMPI_PUBLIC_KEY: z
    .string()
    .regex(
      /^pub_(test|prod)_\w+$/,
      "NEXT_PUBLIC_WOMPI_PUBLIC_KEY debe empezar por pub_test_ o pub_prod_",
    )
    .optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Convierte cadenas vacías en undefined para que los campos opcionales funcionen. */
function emptyToUndefined(source: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
}

/** Valida un objeto de variables y lanza un error claro en español si algo falla. */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(emptyToUndefined(source));
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }
  return result.data;
}

// Next.js solo reemplaza las variables NEXT_PUBLIC_* escritas de forma literal,
// por eso las listamos una por una en lugar de pasar process.env completo.
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  NEXT_PUBLIC_BUSINESS_NAME: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Estudio de Maquillaje",
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  NEXT_PUBLIC_BUSINESS_LEGAL_ID: process.env.NEXT_PUBLIC_BUSINESS_LEGAL_ID,
  NEXT_PUBLIC_BUSINESS_ADDRESS: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_WOMPI_PUBLIC_KEY: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY,
});

/** Devuelve la URL y la clave pública de Supabase, o lanza un error claro si faltan. */
export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (ver README).",
    );
  }
  return { url, anonKey };
}
