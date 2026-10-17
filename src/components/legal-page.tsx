import type { ReactNode } from "react";

/** Plantilla de las páginas legales: título, versión y texto con buena lectura. */
export function LegalPage({
  title,
  version,
  children,
}: {
  title: string;
  version: string;
  children: ReactNode;
}) {
  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Versión {version} · Borrador pendiente de revisión por un abogado.
      </p>
      <div className="mt-6 grid gap-4 text-base leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}
