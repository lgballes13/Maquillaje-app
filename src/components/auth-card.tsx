import type { ReactNode } from "react";

/** Tarjeta centrada para los formularios de cuenta (ingresar, registro…). */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="contenido" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-4 text-center text-sm">{footer}</div> : null}
    </main>
  );
}
