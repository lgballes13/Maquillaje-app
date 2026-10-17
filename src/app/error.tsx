"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

// Se muestra cuando una página falla. El error se envía a Sentry,
// pero al cliente nunca le mostramos detalles técnicos.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      id="contenido"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-muted-foreground">
        Tuvimos un problema al cargar esta página. Intenta de nuevo en un momento.
      </p>
      <Button className="mt-6" onClick={() => reset()}>
        Intentar de nuevo
      </Button>
    </main>
  );
}
