"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Último recurso: se usa si falla incluso el layout principal.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Algo salió mal</h1>
        <p>Por favor recarga la página. Si el problema continúa, escríbenos por WhatsApp.</p>
      </body>
    </html>
  );
}
