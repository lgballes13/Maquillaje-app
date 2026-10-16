/**
 * Encabezados de seguridad fijos (no dependen de la petición).
 * La CSP va aparte en src/proxy.ts porque lleva un nonce por petición.
 */
export const securityHeaders: { key: string; value: string }[] = [
  // HSTS: obliga al navegador a usar siempre HTTPS durante 2 años.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Impide que otra página meta la nuestra en un iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Impide que el navegador "adivine" el tipo de archivo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Al salir hacia otro sitio solo se envía el dominio, no la ruta completa.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs del navegador que no usamos.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
  },
  // Aísla nuestra ventana de ventanas abiertas por otros sitios.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
