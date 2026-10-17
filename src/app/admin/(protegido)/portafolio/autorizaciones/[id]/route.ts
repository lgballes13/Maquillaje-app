import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";
import { CONSENT_BUCKET } from "@/modules/portfolio/queries";

/**
 * Abre el formato firmado con un enlace temporal de 60 segundos. El bucket es
 * privado: sin este enlace nadie puede ver el archivo, y solo la admin con 2FA
 * llega hasta aquí (requireAdmin + RLS del bucket).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/admin/portafolio/autorizaciones/[id]">,
) {
  const { id } = await params;
  await requireAdmin("/admin/portafolio");
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: consent } = await supabase
    .from("portfolio_consents")
    .select("document_path")
    .eq("id", id)
    .maybeSingle();
  if (!consent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase.storage
    .from(CONSENT_BUCKET)
    .createSignedUrl(consent.document_path, 60);
  if (error || !data) {
    console.error("Error al abrir el formato", error?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
