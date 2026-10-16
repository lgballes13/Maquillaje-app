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
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
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
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
