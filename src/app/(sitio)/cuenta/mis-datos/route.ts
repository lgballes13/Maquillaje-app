import { NextResponse } from "next/server";
import { PRIVACY_POLICY_VERSION } from "@/config/legal";
import { siteConfig } from "@/config/site";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";

/**
 * Descarga de «mis datos» (Ley 1581, derecho de acceso): todo lo que la app
 * guarda de la clienta con sesión, en un archivo JSON. RLS garantiza que cada
 * consulta solo devuelve lo propio.
 */
export async function GET() {
  const user = await requireUser("/cuenta");
  if (!(await consumeRateLimit("account:user", user.id))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createClient();
  const [profile, appointments, payments, orders, credit, waitlist] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, phone, marketing_opt_in, privacy_policy_version, privacy_accepted_at, created_at",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("appointments")
      .select(
        "service_name, starts_at, ends_at, status, price_cop, deposit_cop, credit_applied_cop, customer_notes, policy_accepted_at, created_at",
      )
      .eq("customer_id", user.id)
      .order("starts_at"),
    supabase
      .from("payments")
      .select(
        "reference, amount_in_cents, status, payment_method, approved_at, created_at, appointments!inner(customer_id)",
      )
      .eq("appointments.customer_id", user.id)
      .order("created_at"),
    supabase
      .from("orders")
      .select(
        "number, kind, status, delivery_method, recipient_name, phone, address, city, customer_notes, subtotal_cop, shipping_cop, credit_applied_cop, total_cop, created_at, paid_at, order_items(product_name, quantity, unit_price_cop, line_total_cop), order_payments(reference, stage, amount_in_cents, status, payment_method, approved_at)",
      )
      .eq("customer_id", user.id)
      .order("created_at"),
    supabase
      .from("credit_movements")
      .select("amount_cop, reason, created_at, expires_at")
      .eq("customer_id", user.id)
      .order("created_at"),
    supabase
      .from("product_waitlist")
      .select("created_at, notified_at, products(name)")
      .eq("customer_id", user.id),
  ]);

  const failed = [profile, appointments, payments, orders, credit, waitlist].find((r) => r.error);
  if (failed?.error) {
    console.error("Error al exportar los datos", failed.error.code, failed.error.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const body = {
    generado: new Date().toISOString(),
    responsable: siteConfig.name,
    politica_vigente: PRIVACY_POLICY_VERSION,
    cuenta: { correo: user.email, ...profile.data },
    citas: appointments.data,
    pagos_de_citas: payments.data?.map(({ appointments: _a, ...p }) => p),
    pedidos: orders.data,
    saldo_a_favor: credit.data,
    listas_de_espera: waitlist.data,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mis-datos.json"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
