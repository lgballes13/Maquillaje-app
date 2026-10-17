import Link from "next/link";
import { Settings2 } from "lucide-react";

export default function AdminHomePage() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
      <p className="mt-2 text-muted-foreground">
        Aquí irán la agenda, los pedidos, los productos y los reportes en las próximas fases.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/admin/reglas"
            className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-xs hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Settings2 aria-hidden="true" className="size-6 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold">Reglas del negocio</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Anticipos, plazos, penalidades y horario de atención.
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
