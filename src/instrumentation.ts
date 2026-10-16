import * as Sentry from "@sentry/nextjs";

/**
 * Next.js ejecuta register() una vez al iniciar el servidor.
 * Sentry solo se activa si existe la variable NEXT_PUBLIC_SENTRY_DSN.
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // 10 % de las peticiones se miden para rendimiento (suficiente y barato).
    tracesSampleRate: 0.1,
    // Privacidad (Ley 1581): no enviar datos del usuario, cookies, encabezados
    // ni cuerpos de peticiones (podrían tener nombres, teléfonos o correos).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });
}

// Captura los errores que ocurren al renderizar en el servidor.
export const onRequestError = Sentry.captureRequestError;
