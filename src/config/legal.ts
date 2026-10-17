/**
 * Versión vigente de la política de tratamiento de datos (Ley 1581 de 2012).
 * Cuando cambie el texto de /privacidad, sube esta versión: queda guardada en el
 * perfil de cada persona junto con la fecha en que la aceptó.
 */
export const PRIVACY_POLICY_VERSION = "2026-10-17";

/** Versión de los términos y condiciones (/terminos). */
export const TERMS_VERSION = "2026-10-17";

/** Plazos de respuesta de la Ley 1581 (arts. 14 y 15), en días hábiles. */
export const HABEAS_DATA_DAYS = { query: 10, queryExtension: 5, claim: 15, claimExtension: 8 };

/** Valor del negocio o un aviso visible de que falta, para no publicar textos incompletos. */
export function legalValue(value: string | undefined): string {
  return value?.trim() ? value.trim() : "[pendiente]";
}
