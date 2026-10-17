import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

// Zod prueba si puede usar `new Function` para validar más rápido; la CSP lo
// bloquea (bien hecho) y el navegador lo reporta como problema. Se lo apagamos.
z.config({ jitless: true });

// Se ejecuta en el navegador antes de que la app arranque.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
