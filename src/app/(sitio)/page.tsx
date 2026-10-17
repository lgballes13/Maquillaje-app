import Link from "next/link";
import { CalendarHeart, ShoppingBag, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

// Secciones del sitio; las que no tienen enlace llegan en las próximas fases.
const sections = [
  {
    title: "Agenda tu cita",
    description: "Maquillaje social, de novia y asesorías. Elige día y hora en 3 pasos.",
    icon: CalendarHeart,
    href: "/agendar",
    cta: "Agendar ahora",
  },
  {
    title: "Tienda",
    description: "Productos con stock en tiempo real y preventa de los agotados.",
    icon: ShoppingBag,
    href: null,
    cta: null,
  },
  {
    title: "Portafolio",
    description: "Mira nuestros trabajos y agenda el estilo que más te guste.",
    icon: Sparkles,
    href: null,
    cta: null,
  },
] as const;

export default function HomePage() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <section aria-labelledby="titulo-principal" className="mb-10">
        <h1 id="titulo-principal" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Maquillaje profesional para cada ocasión
        </h1>
        <p className="mt-3 max-w-prose text-base text-muted-foreground">{siteConfig.description}</p>
      </section>

      <section aria-labelledby="titulo-secciones">
        <h2 id="titulo-secciones" className="sr-only">
          Secciones del sitio
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {sections.map(({ title, description, icon: Icon, href, cta }) => (
            <li key={title} className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <Icon aria-hidden="true" className="mb-3 size-8 text-primary" />
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              {href ? (
                <Link href={href} className={buttonVariants({ className: "mt-3" })}>
                  {cta}
                </Link>
              ) : (
                <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  Próximamente
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
