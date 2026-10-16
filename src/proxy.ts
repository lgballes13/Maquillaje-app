import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/security/csp";

/**
 * El "proxy" (antes llamado middleware) se ejecuta antes de cada página.
 * Aquí generamos un nonce nuevo por petición y armamos la CSP con él.
 * Next.js lee la CSP de la petición y le pone el nonce a sus propios scripts.
 */
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    upgradeInsecureRequests: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Todas las rutas excepto API, archivos estáticos, imágenes optimizadas,
      // el túnel de Sentry y archivos públicos con extensión (iconos, etc.).
      source:
        "/((?!api|_next/static|_next/image|monitoring|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
