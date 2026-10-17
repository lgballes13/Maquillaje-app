import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { toZonedDateString } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/session";
import { csvFileName } from "@/modules/admin/csv";
import { resolveCustomerSearch } from "@/modules/admin/customers";
import {
  appointmentsCsv,
  customersCsv,
  EXPORT_KINDS,
  ordersCsv,
  reportCsv,
  type ExportKind,
} from "@/modules/admin/exports";
import { resolveReportRange } from "@/modules/admin/reports";

/**
 * Descarga CSV del panel. Solo la admin con 2FA llega aquí (requireAdmin +
 * RLS), cada descarga queda en la auditoría y el archivo no se guarda en caché.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/admin/exportar/[tipo]">,
) {
  const { tipo } = await params;
  await requireAdmin("/admin");
  if (!EXPORT_KINDS.includes(tipo as ExportKind)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const kind = tipo as ExportKind;

  const query = request.nextUrl.searchParams;
  const today = toZonedDateString(new Date(), siteConfig.timeZone);
  const range = resolveReportRange(
    { desde: query.get("desde") ?? undefined, hasta: query.get("hasta") ?? undefined },
    today,
  );
  if (range.error) return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  const search = resolveCustomerSearch(query.get("q") ?? undefined);

  const result =
    kind === "citas"
      ? await appointmentsCsv(range.from, range.to)
      : kind === "pedidos"
        ? await ordersCsv(range.from, range.to)
        : kind === "clientas"
          ? await customersCsv(search)
          : await reportCsv(range.from, range.to);

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_admin_export", {
    p_kind: kind,
    p_detail:
      kind === "clientas"
        ? { busqueda: search || null, filas: result.rows }
        : { desde: range.from, hasta: range.to, filas: result.rows },
  });
  // Sin registro en la auditoría no se entrega el archivo.
  if (error) {
    console.error("Error al registrar la descarga", error.code, error.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const fileName =
    kind === "clientas" ? csvFileName(kind, today) : csvFileName(kind, range.from, range.to);
  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
