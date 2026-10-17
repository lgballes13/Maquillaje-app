import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Límites por acción: cuántos intentos se permiten en cuántos segundos.
 * Se cuentan por IP y, cuando aplica, también por correo, para frenar tanto a
 * quien prueba muchas contraseñas como a quien ataca una sola cuenta.
 */
export const RATE_LIMITS = {
  "login:ip": { limit: 20, windowSeconds: 15 * 60 },
  "login:email": { limit: 5, windowSeconds: 15 * 60 },
  "signup:ip": { limit: 5, windowSeconds: 60 * 60 },
  "reset:ip": { limit: 10, windowSeconds: 60 * 60 },
  "reset:email": { limit: 3, windowSeconds: 60 * 60 },
  "mfa:user": { limit: 5, windowSeconds: 5 * 60 },
  // Reservas: evita que alguien aparte horarios en masa para bloquear la agenda.
  "booking:user": { limit: 10, windowSeconds: 60 * 60 },
  // Cancelar y cambiar de horario.
  "appointment:user": { limit: 20, windowSeconds: 60 * 60 },
  // Tienda: crear y cancelar pedidos (cada pedido aparta unidades).
  "order:user": { limit: 20, windowSeconds: 60 * 60 },
  // Lista de espera: inscribirse o salirse (cada aviso es un correo).
  "waitlist:user": { limit: 30, windowSeconds: 60 * 60 },
  // Mi cuenta: descargar mis datos y eliminar la cuenta (pide la contraseña).
  "account:user": { limit: 10, windowSeconds: 60 * 60 },
  // Panel: subir fotos de productos.
  "upload:user": { limit: 60, windowSeconds: 60 * 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Las llaves se guardan como un hash SHA-256: así la tabla no almacena
 * correos ni IP en texto plano (minimización de datos, Ley 1581).
 */
export function rateLimitKey(name: RateLimitName, identifier: string): string {
  const hash = createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
  return `${name}:${hash}`;
}

/** IP del visitante. En Vercel, el primer valor de x-forwarded-for es confiable. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
}

/**
 * Registra un intento y dice si está permitido.
 * Si la base de datos no responde, se BLOQUEA (falla cerrado): es preferible
 * que alguien reintente en un minuto a quedar sin protección.
 */
export async function consumeRateLimit(name: RateLimitName, identifier: string): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  try {
    const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
      p_key: rateLimitKey(name, identifier),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("Error en el límite de intentos", error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("Error en el límite de intentos", error);
    return false;
  }
}

/** Revisa varios límites a la vez; basta con que uno se supere para bloquear. */
export async function consumeRateLimits(
  checks: { name: RateLimitName; identifier: string }[],
): Promise<boolean> {
  const results = await Promise.all(checks.map((c) => consumeRateLimit(c.name, c.identifier)));
  return results.every(Boolean);
}

export const RATE_LIMIT_MESSAGE =
  "Hiciste demasiados intentos. Por seguridad, espera unos minutos y vuelve a intentarlo.";
