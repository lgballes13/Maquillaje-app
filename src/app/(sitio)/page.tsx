import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { ArrowRight, MessageCircle, Quote } from "lucide-react";
import { FillImage } from "@/components/fill-image";
import { TESTIMONIALS } from "@/config/testimonials";
import { buildWhatsAppUrl } from "@/lib/utils";
import { HomeGallery, type GalleryWork } from "@/modules/portfolio/components/home-gallery";
import { getPortfolioCategories, getPublishedWorks } from "@/modules/portfolio/queries";
import { UNOPTIMIZED_IMAGES } from "@/modules/shop/images";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/section-heading";
import heroImage from "../../../public/images/hero-editorial.webp";
import moduloAgenda from "../../../public/images/modulo-agenda.webp";
import moduloPortafolio from "../../../public/images/modulo-portafolio.webp";
import moduloTienda from "../../../public/images/modulo-tienda.webp";
import servicioAsesoria from "../../../public/images/servicio-asesoria.webp";
import servicioNovia from "../../../public/images/servicio-novia.webp";
import servicioSocial from "../../../public/images/servicio-social.webp";

// Servicios que se pueden agendar. Las fotos se cambian reemplazando el archivo en public/images.
const SERVICES = [
  {
    title: "Maquillaje social",
    description:
      "Para grados, cenas, fiestas y sesiones de fotos. Un acabado luminoso y duradero que resalta tus rasgos.",
    image: servicioSocial,
    alt: "Paleta de sombras en tonos vino, dorado y nude junto a unos aretes",
  },
  {
    title: "Maquillaje de novia",
    description:
      "Un look pensado para tu vestido, tu peinado y tus fotos, con un acabado que dura de la ceremonia a la fiesta.",
    image: servicioNovia,
    alt: "Flores blancas, un collar de perlas y un perfume sobre seda marfil",
  },
  {
    title: "Asesoría personalizada",
    description:
      "Aprende a elegir tus productos y a maquillarte según tu tipo de piel, tus rasgos y tu estilo.",
    image: servicioAsesoria,
    alt: "Espejo dorado, brochas en un vaso y una libreta de apuntes",
  },
] as const;

// Módulos de la app destacados en el inicio.
const MODULES = [
  {
    eyebrow: "Agenda en línea",
    title: "Reserva tu cita en minutos",
    description:
      "Elige el servicio, el día y la hora que mejor te queden. Recibes la confirmación por correo y puedes reprogramar desde tu cuenta.",
    href: "/agendar",
    cta: "Ver horarios disponibles",
    image: moduloAgenda,
    alt: "Calendario con un día marcado en borgoña junto a un labial",
  },
  {
    eyebrow: "Tienda",
    title: "Los productos que usamos en el estudio",
    description:
      "Compra con el stock al día y reserva en preventa lo que esté agotado. Recoge en el estudio o recibe en casa.",
    href: "/tienda",
    cta: "Ir a la tienda",
    image: moduloTienda,
    alt: "Repisa dorada con frascos de base, crema, labiales y una bolsa de compras",
  },
  {
    eyebrow: "Portafolio",
    title: "Inspírate con trabajos reales",
    description:
      "Looks de novias, eventos y sesiones, con fotos de antes y después autorizadas por cada clienta.",
    href: "/portafolio",
    cta: "Ver portafolio",
    image: moduloPortafolio,
    alt: "Marcos dorados en arco con retratos de perfil dibujados en línea",
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

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Filtro de la galería (?galeria=<id de categoría>); un valor inválido muestra todos.
  const requested = z.uuid().safeParse((await searchParams).galeria);
  const galleryCategoryId = requested.success ? requested.data : null;
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

      <Services />
      <Modules />
      <Gallery categoryId={galleryCategoryId} />
      <Testimonials />
      <FinalCta />
    </main>
  );
}

/** Tres tarjetas con los servicios principales; cada una lleva a la agenda. */
function Services() {
  return (
    <section aria-labelledby="titulo-servicios" className="px-4 py-20 sm:py-24">
      <SectionHeading
        id="titulo-servicios"
        eyebrow="Servicios"
        title="Un look para cada momento"
        description="Trabajamos con productos profesionales y una piel bien preparada para que tu maquillaje luzca natural en persona y en cámara."
      />
      <ul className="mx-auto mt-14 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <li
            key={service.title}
            className="group flex flex-col rounded-[2rem] border border-gold/30 bg-card p-3 shadow-sm shadow-plum/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-plum/10"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[1.5rem] bg-secondary">
              <FillImage
                unoptimized
                src={service.image}
                alt={service.alt}
                sizes="(min-width: 1152px) 360px, (min-width: 640px) 45vw, 92vw"
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col px-3 pt-6 pb-3">
              <h3 className="text-3xl text-plum">{service.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {service.description}
              </p>
              <Link
                href="/agendar"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-6 self-start border-primary/40 text-primary",
                )}
              >
                Agendar<span className="sr-only"> {service.title.toLowerCase()}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Agenda, tienda y portafolio en bloques alternados de imagen y texto. */
function Modules() {
  return (
    <section
      aria-labelledby="titulo-modulos"
      className="bg-[linear-gradient(180deg,var(--color-muted)_0%,var(--color-secondary)_100%)] px-4 py-20 sm:py-24"
    >
      <SectionHeading
        id="titulo-modulos"
        eyebrow="Todo en un solo lugar"
        title={
          <>
            Agenda, compra y <em className="text-primary">déjate inspirar</em>
          </>
        }
      />
      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-16 md:gap-24">
        {MODULES.map((module, index) => (
          <article
            key={module.href}
            aria-labelledby={`modulo-${index}`}
            className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
          >
            <div
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-gold/40 bg-card shadow-xl shadow-plum/10",
                index % 2 === 1 && "md:order-last",
              )}
            >
              <FillImage
                unoptimized
                src={module.image}
                alt={module.alt}
                sizes="(min-width: 1152px) 550px, (min-width: 768px) 46vw, 92vw"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-gold-foreground uppercase">
                <span aria-hidden="true" className="mr-2 font-serif text-base tracking-normal">
                  0{index + 1}
                </span>
                {module.eyebrow}
              </p>
              <h3 id={`modulo-${index}`} className="mt-3 text-4xl leading-tight text-plum">
                {module.title}
              </h3>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                {module.description}
              </p>
              <Link href={module.href} className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
                {module.cta}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Galería editorial con los trabajos publicados del portafolio. */
function Gallery({ categoryId }: { categoryId: string | null }) {
  return (
    <section aria-labelledby="titulo-galeria" className="px-4 py-20 sm:py-24">
      <SectionHeading
        id="titulo-galeria"
        eyebrow="Galería"
        title={
          <>
            Trabajos <em className="text-primary">reales</em>
          </>
        }
        description="Novias, eventos y sesiones beauty. Cada foto se publica con la autorización firmada de la clienta."
      />
      <div className="mx-auto max-w-6xl">
        {/* La galería consulta la base de datos: el resto del inicio se muestra sin esperarla. */}
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          }
        >
          <GalleryWorks categoryId={categoryId} />
        </Suspense>
        <p className="mt-10 text-center">
          <Link
            href="/portafolio"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-primary/40")}
          >
            Ver todo el portafolio
            <ArrowRight aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Cuántos trabajos muestra la galería por filtro; el resto está en /portafolio. */
const GALLERY_SIZE = 6;

async function GalleryWorks({ categoryId }: { categoryId: string | null }) {
  const categories = await getPortfolioCategories();
  const active = categories.find((category) => category.id === categoryId) ?? null;
  // Se piden de más por si alguno no tiene foto todavía.
  const works = await getPublishedWorks(active?.id ?? null, { limit: GALLERY_SIZE * 2 });
  const withImage = works.flatMap((work) => {
    const cover = work.after ?? work.before;
    return cover ? [{ ...work, image: { url: cover.url, alt: cover.alt } }] : [];
  });

  if (!active && withImage.length === 0) {
    return (
      <div
        data-testid="gallery-empty"
        className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-gold/40 bg-card px-6 py-12 text-center shadow-lg shadow-plum/5"
      >
        <span aria-hidden="true" className="mx-auto block size-2 rotate-45 bg-gold" />
        <p className="mt-5 font-serif text-3xl text-plum">Muy pronto, nuestros trabajos</p>
        <p className="mt-3 text-muted-foreground">
          Estamos preparando la galería con fotos autorizadas por nuestras clientas. Mientras tanto,
          reserva tu cita y sé parte de ella.
        </p>
        <Link href="/agendar" className={cn(buttonVariants(), "mt-6")}>
          Agendar cita
        </Link>
      </div>
    );
  }

  const shown: GalleryWork[] = withImage
    .slice(0, GALLERY_SIZE)
    .map(({ id, title, categoryName, image }) => ({ id, title, categoryName, image }));
  return (
    <HomeGallery
      categories={categories}
      active={active}
      works={shown}
      unoptimized={UNOPTIMIZED_IMAGES}
    />
  );
}

/** Testimonios de clientas; los de ejemplo se marcan como tales (ver src/config/testimonials.ts). */
function Testimonials() {
  return (
    <section
      aria-labelledby="titulo-testimonios"
      className="bg-[linear-gradient(180deg,var(--color-muted)_0%,var(--color-background)_100%)] px-4 py-20 sm:py-24"
    >
      <SectionHeading
        id="titulo-testimonios"
        eyebrow="Testimonios"
        title={
          <>
            Lo que dicen <em className="text-primary">nuestras clientas</em>
          </>
        }
      />
      <ul className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial, index) => (
          <li key={index}>
            <figure className="relative flex h-full flex-col rounded-[2rem] border border-gold/40 bg-card px-6 pt-10 pb-7 shadow-lg shadow-plum/5">
              <Quote aria-hidden="true" className="absolute top-6 left-6 size-7 text-gold" />
              {testimonial.sample ? (
                <span className="absolute top-6 right-6 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Ejemplo
                </span>
              ) : null}
              <blockquote className="mt-6 flex-1 font-serif text-xl leading-snug text-plum">
                <p>{testimonial.quote}</p>
              </blockquote>
              <figcaption className="mt-6 border-t border-border pt-4 text-sm">
                <span className="block font-semibold text-foreground">{testimonial.name}</span>
                <span className="text-muted-foreground">{testimonial.occasion}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Franja final: invitación a reservar, con WhatsApp si hay número configurado. */
function FinalCta() {
  return (
    <section aria-labelledby="titulo-reserva" className="bg-plum px-4 py-20 text-plum-foreground">
      <div className="mx-auto max-w-3xl text-center">
        <p className="flex items-center justify-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-gold" />
          Tu próxima cita
          <span aria-hidden="true" className="h-px w-8 bg-gold" />
        </p>
        <h2 id="titulo-reserva" className="mt-4 text-4xl leading-tight sm:text-5xl">
          Reserva tu cita y <em className="text-gold">déjate consentir</em>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-plum-foreground/85 sm:text-lg">
          Elige el servicio, el día y la hora en línea. Si tienes dudas sobre tu look, escríbenos
          antes de agendar.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/agendar"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-gold text-plum hover:bg-gold/90 focus-visible:ring-gold/50",
            )}
          >
            Agendar cita
            <ArrowRight aria-hidden="true" />
          </Link>
          {siteConfig.whatsappNumber ? (
            <a
              href={buildWhatsAppUrl(siteConfig.whatsappNumber, siteConfig.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "border-plum-foreground/40 bg-transparent text-plum-foreground hover:bg-plum-foreground/10 hover:text-plum-foreground",
              )}
            >
              <MessageCircle aria-hidden="true" />
              Escribir por WhatsApp
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
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
              className={cn(buttonVariants({ size: "lg" }), "shadow-md shadow-primary/20")}
            >
              Agendar cita
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href="/portafolio"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "border-primary/40 bg-transparent text-primary",
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
                <span aria-hidden="true" className="size-1.5 rotate-45 bg-gold" />
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
            {/* Las ilustraciones pesan menos de 30 KB: se sirven tal cual, sin pasar por el
                optimizador de imágenes, que en la primera visita tarda en generarlas. */}
            <FillImage
              unoptimized
              src={heroImage}
              alt="Bodegón de maquillaje: labial borgoña, polvo compacto dorado y brocha sobre seda"
              sizes="(min-width: 1152px) 480px, (min-width: 768px) 42vw, 384px"
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
