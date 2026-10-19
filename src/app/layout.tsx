import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { siteConfig } from "@/config/site";
import { WhatsAppButton } from "@/components/whatsapp-button";
import "./globals.css";

// next/font descarga la fuente al compilar y la sirve desde nuestro dominio:
// no hay peticiones a Google desde el navegador del cliente (privacidad y CSP).
const manrope = Manrope({
  variable: "--font-sans-family",
  subsets: ["latin"],
  display: "swap",
});

// Serif editorial solo para títulos (h1, h2, h3 y el logo).
const cormorant = Cormorant_Garamond({
  variable: "--font-serif-family",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#79243f",
  // Permite que la app use toda la pantalla en iPhone con "notch".
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Leer los encabezados obliga a renderizar cada página por petición,
  // requisito para que el nonce de la CSP sea distinto cada vez (DT-004).
  await headers();

  return (
    <html lang="es" className={`${manrope.variable} ${cormorant.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        {/* Enlace oculto para usuarios de teclado: salta directo al contenido. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        {children}
        <WhatsAppButton phone={siteConfig.whatsappNumber} message={siteConfig.whatsappMessage} />
      </body>
    </html>
  );
}
