/**
 * Decide qué pasa cuando alguien intenta entrar al panel de administración.
 * Es una función pura (sin base de datos) para poder probarla fácilmente.
 *
 * - "login":    no ha iniciado sesión → a /ingresar
 * - "forbidden": no es admin → página no encontrada (no revelamos que existe)
 * - "enroll":   es admin pero no ha configurado el segundo factor → a configurarlo
 * - "verify":   tiene segundo factor pero no lo usó en esta sesión → pedir el código
 * - "allow":    admin con sesión verificada con segundo factor (aal2)
 */
export type AdminAccess = "login" | "forbidden" | "enroll" | "verify" | "allow";

export type AssuranceLevel = string | null | undefined;

export interface AdminAccessInput {
  isLoggedIn: boolean;
  hasAdminRole: boolean;
  currentLevel: AssuranceLevel;
  nextLevel: AssuranceLevel;
}

export function decideAdminAccess(input: AdminAccessInput): AdminAccess {
  if (!input.isLoggedIn) return "login";
  if (!input.hasAdminRole) return "forbidden";
  if (input.currentLevel === "aal2") return "allow";
  // nextLevel = aal2 significa que ya tiene un factor verificado y puede subir de nivel.
  if (input.nextLevel === "aal2") return "verify";
  return "enroll";
}
