import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { safeRedirectPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Aquí llegan los enlaces de los correos de Supabase (confirmar cuenta y
 * recuperar contraseña). Cambia el código temporal por una sesión y redirige.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), "/cuenta");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, siteConfig.url));
  }

  return NextResponse.redirect(new URL("/ingresar?error=enlace", siteConfig.url));
}
