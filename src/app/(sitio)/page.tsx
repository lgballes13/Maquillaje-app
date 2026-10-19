import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, CalendarHeart, ShoppingBag, Sparkles } from "lucide-react";
import { FillImage } from "@/components/fill-image";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import heroImage from "../../../public/images/hero-editorial.webp";

// Secciones principales del sitio.
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
    href: "/tienda",
    cta: "Ver la tienda",
  },
  {
    title: "Portafolio",
    description: "Mira nuestros trabajos y agenda el estilo que más te guste.",
    icon: Sparkles,
    href: "/portafolio",
    cta: "Ver trabajos",
  },
] as const;

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Datos del negocio para Google (schema.org); solo incluye lo que ya está definido. */
function businessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    image: `${siteConfig.url}/opengraph-image`,
    ...(siteConfig.whatsappNumber ? { telephone: `+${siteConfig.whatsappNumber}` } : {}),
    ...(siteConfig.contactEmail ? { email: siteConfig.contactEmail } : {}),
    ...(siteConfig.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: siteConfig.address,
            addressCountry: "CO",
          },
        }
      : {}),
  };
}

export default async function HomePage() {
  // El JSON-LD va en un <script>: lleva el nonce de la CSP como los demás (DT-004).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <main id="contenido" className="flex-1">
      <script
        type="application/ld+json"
        nonce={nonce}
        // JSON.stringify de datos propios; se escapa «<» para que no pueda cerrar el script.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessJsonLd()).replace(/</g, "\\u003c"),
        }}
      />
      <Hero />

      <div className="mx-auto w-full max-w-5xl px-4 py-10">
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
                <Link href={href} className={buttonVariants({ className: "mt-3" })}>
                  {cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

const SPECIALTIES = ["Novias", "Eventos sociales", "Asesorías"] as const;

/** Portada: título, propuesta de valor y las dos acciones principales. */
function Hero() {
  return (
    <section
      aria-labelledby="titulo-principal"
      className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_left,var(--color-secondary)_0%,transparent_55%),linear-gradient(180deg,var(--color-background)_0%,var(--color-muted)_100%)]"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:pt-16 md:pb-24 lg:gap-16">
        <div>
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold-foreground uppercase">
            <span aria-hidden="true" className="h-px w-10 bg-gold" />
            Estudio boutique de maquillaje
          </p>
          <h1
            id="titulo-principal"
            className="mt-5 text-5xl leading-[1.02] text-plum sm:text-6xl lg:text-7xl"
          >
            Tu belleza, <em className="text-primary">elevada</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Maquillaje profesional para novias, eventos sociales y asesorías personalizadas. Un
            acabado impecable que se siente tuyo, de la primera foto al último baile.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/agendar"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full px-8 shadow-md shadow-primary/20",
              )}
            >
              Agendar cita
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href="/portafolio"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "rounded-full border-primary/40 bg-transparent px-8 text-primary",
              )}
            >
              Ver portafolio
            </Link>
          </div>
          <ul
            aria-label="Especialidades"
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/80"
          >
            {SPECIALTIES.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-gold">
                  ✦
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-sm md:max-w-none">
          {/* Marco en arco con un filete dorado desplazado, estilo editorial. */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 translate-x-3 translate-y-3 rounded-t-full border border-gold/70"
          />
          <div className="relative aspect-[4/5] overflow-hidden rounded-t-full bg-secondary shadow-2xl shadow-plum/20">
            <FillImage
              src={heroImage}
              alt="Bodegón de maquillaje: labial borgoña, polvo compacto dorado y brocha sobre seda"
              sizes="(min-width: 1152px) 480px, (min-width: 768px) 42vw, 384px"
              preload
              loading="eager"
              fetchPriority="high"
              className="object-cover"
            />
          </div>
          <p className="absolute -bottom-5 left-4 max-w-60 rounded-2xl border border-gold/40 bg-card/95 px-4 py-3 text-sm shadow-lg shadow-plum/10 backdrop-blur">
            <span className="block font-serif text-lg text-primary">Agenda en línea</span>
            <span className="text-muted-foreground">Elige día y hora en 3 pasos.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
