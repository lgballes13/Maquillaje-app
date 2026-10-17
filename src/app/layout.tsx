import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { siteConfig } from "@/config/site";
import { WhatsAppButton } from "@/components/whatsapp-button";
import "./globals.css";

// next/font descarga la fuente al compilar y la sirve desde nuestro dominio:
// no hay peticiones a Google desde el navegador del cliente (privacidad y CSP).
const inter = Inter({
  variable: "--font-sans-family",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#9b1c4a",
  // Permite que la app use toda la pantalla en iPhone con "notch".
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Leer los encabezados obliga a renderizar cada página por petición,
  // requisito para que el nonce de la CSP sea distinto cada vez (DT-004).
  await headers();

  return (
    <html lang="es" className={inter.variable}>
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
