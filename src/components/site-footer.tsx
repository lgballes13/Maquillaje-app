import Link from "next/link";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/social-icons";
import { siteConfig } from "@/config/site";
import { buildWhatsAppUrl } from "@/lib/utils";

const EXPLORE = [
  { href: "/agendar", label: "Agendar cita" },
  { href: "/tienda", label: "Tienda" },
  { href: "/portafolio", label: "Portafolio" },
  { href: "/cuenta", label: "Mi cuenta" },
];

const LEGAL = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de tratamiento de datos" },
];

// Cada red aparece solo si tiene enlace en la configuración (NEXT_PUBLIC_*_URL).
const SOCIAL = [
  { name: "Instagram", href: siteConfig.social.instagram, Icon: InstagramIcon },
  { name: "TikTok", href: siteConfig.social.tiktok, Icon: TikTokIcon },
  { name: "Facebook", href: siteConfig.social.facebook, Icon: FacebookIcon },
].filter((network) => network.href);

const linkClass =
  "inline-flex min-h-11 min-w-11 items-center rounded-md transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

const titleClass = "text-xs font-semibold tracking-[0.25em] text-gold-foreground uppercase";

export function SiteFooter() {
  const { whatsappNumber, contactEmail, address } = siteConfig;
  const hasContact = Boolean(whatsappNumber || contactEmail || address);

  return (
    <footer className="border-t border-gold/40 bg-muted px-4 pt-14 pb-8 text-sm text-foreground/85">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl tracking-[0.18em] text-plum uppercase">
            {siteConfig.name}
          </p>
          <p className="mt-2 font-serif text-lg text-primary">{siteConfig.tagline}</p>
          <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
            Estudio boutique de maquillaje para novias, eventos sociales y asesorías personalizadas.
          </p>
          {SOCIAL.length ? (
            <ul aria-label="Redes sociales" className="mt-5 flex gap-2">
              {SOCIAL.map(({ name, href, Icon }) => (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-11 items-center justify-center rounded-full border border-gold/50 bg-card text-plum transition-colors hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Icon className="size-5" />
                    <span className="sr-only">{name} (se abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <nav aria-labelledby="pie-explora">
          <p id="pie-explora" className={titleClass}>
            Explora
          </p>
          <ul className="mt-3">
            {EXPLORE.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {hasContact ? (
          <div>
            <p className={titleClass}>Contacto</p>
            <ul className="mt-3 grid gap-1">
              {whatsappNumber ? (
                <li>
                  <a
                    href={buildWhatsAppUrl(whatsappNumber, siteConfig.whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkClass} gap-2`}
                  >
                    <MessageCircle aria-hidden="true" className="size-4 text-gold-foreground" />
                    WhatsApp
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                </li>
              ) : null}
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className={`${linkClass} gap-2 break-all`}>
                    <Mail aria-hidden="true" className="size-4 shrink-0 text-gold-foreground" />
                    {contactEmail}
                  </a>
                </li>
              ) : null}
              {address ? (
                <li className="flex min-h-11 items-center gap-2">
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-gold-foreground" />
                  {address}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-2 border-t border-border pt-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <nav aria-label="Información legal">
          <ul className="flex flex-wrap gap-x-5">
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${linkClass} underline-offset-4 hover:underline`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
