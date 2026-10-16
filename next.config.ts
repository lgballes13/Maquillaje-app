import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  // No anunciar que el sitio usa Next.js (menos información para un atacante).
  poweredByHeader: false,
  reactStrictMode: true,
  // Nota: NO activamos cacheComponents (prerenderizado parcial) porque es
  // incompatible con la CSP con nonce. Ver docs/decisiones.md (DT-004).
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // El manifiesto de la PWA puede cachearse un día.
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Los errores del navegador pasan por nuestro dominio (/monitoring):
  // así no hay que abrir la CSP a Sentry y los bloqueadores no los pierden.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
