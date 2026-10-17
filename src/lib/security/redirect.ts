/**
 * Evita "redirecciones abiertas": que un enlace como
 * /ingresar?next=https://sitio-falso.com mande al usuario a otro dominio
 * después de iniciar sesión. Solo se aceptan rutas internas.
 */
export function safeRedirectPath(next: unknown, fallback = "/cuenta"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 200) return fallback;
  // Debe empezar con "/" pero no con "//" ni "/\" (el navegador los trata como otro dominio).
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Sin caracteres de control (saltos de línea, tabulaciones…).
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
