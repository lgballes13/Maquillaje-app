import { NextResponse } from "next/server";
import { applyWompiTransaction, getWompiConfig } from "@/modules/payments/service";
import { verifyEventSignature, wompiEventSchema } from "@/modules/payments/wompi";

/*
 * Webhook de Wompi: aquí llega el resultado de cada pago.
 * Configúralo en el panel de Wompi → Desarrolladores → URL de eventos:
 *   https://TU-DOMINIO/api/webhooks/wompi
 *
 * Reglas de seguridad:
 * - Se rechaza todo evento cuya firma no coincida con el secreto de eventos.
 * - El mismo evento puede llegar varias veces: la base de datos lo aplica una sola vez.
 * - Responde 200 cuando el evento ya quedó registrado; 5xx solo si falló algo
 *   nuestro, para que Wompi lo reintente.
 */

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const config = getWompiConfig();
  if (!config) return NextResponse.json({ error: "payments_disabled" }, { status: 503 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = wompiEventSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  const event = parsed.data;

  if (!verifyEventSignature(event, config.eventsSecret)) {
    console.warn("Webhook de Wompi con firma inválida");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Un evento de pruebas nunca debe afectar citas reales (ni al revés).
  if (event.environment && event.environment !== config.mode) {
    return NextResponse.json({ result: "ignored_environment" });
  }
  if (event.event !== "transaction.updated") {
    return NextResponse.json({ result: "ignored_event" });
  }

  try {
    const result = await applyWompiTransaction("webhook", event.data.transaction);
    return NextResponse.json({ result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
