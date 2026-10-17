import Link from "next/link";
import { CalendarDays, Scissors, Settings2 } from "lucide-react";

const LINKS = [
  {
    href: "/admin/citas",
    title: "Citas",
    description: "Próximas citas, pagos por revisar y bloqueos de agenda.",
    icon: CalendarDays,
  },
  {
    href: "/admin/servicios",
    title: "Servicios",
    description: "Nombre, duración y precio de lo que se puede agendar.",
    icon: Scissors,
  },
  {
    href: "/admin/reglas",
    title: "Reglas del negocio",
    description: "Anticipos, plazos, penalidades y horario de atención.",
    icon: Settings2,
  },
] as const;

export default function AdminHomePage() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
      <p className="mt-2 text-muted-foreground">
        Los pedidos, los productos y los reportes llegan en las próximas fases.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {LINKS.map(({ href, title, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-xs hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
