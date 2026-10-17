import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/*
 * Integración con Wompi (pasarela de pagos de Colombia).
 *
 * Flujo:
 * 1. La página de la cita arma un formulario hacia el checkout de Wompi con la
 *    referencia, el monto y una FIRMA DE INTEGRIDAD (así nadie puede cambiar el
 *    monto en el navegador: Wompi rechaza la transacción si la firma no cuadra).
 * 2. La clienta paga en Wompi y vuelve a la página de su cita.
 * 3. Wompi avisa el resultado a /api/webhooks/wompi. Verificamos la firma del
 *    evento con el secreto de eventos antes de creerle.
 *
 * Documentación: https://docs.wompi.co
 */

export const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

export type WompiMode = "test" | "prod";

export function wompiMode(publicKey: string): WompiMode {
  return publicKey.startsWith("pub_prod_") ? "prod" : "test";
}

export function wompiApiBase(mode: WompiMode): string {
  return mode === "prod" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Firma de integridad del checkout:
 * SHA256(referencia + monto en centavos + moneda + [fecha de expiración] + secreto de integridad)
 */
export function integritySignature({
  reference,
  amountInCents,
  currency,
  expirationTime,
  integritySecret,
}: {
  reference: string;
  amountInCents: number;
  currency: string;
  expirationTime?: string;
  integritySecret: string;
}): string {
  return sha256(`${reference}${amountInCents}${currency}${expirationTime ?? ""}${integritySecret}`);
}

export interface CheckoutInput {
  publicKey: string;
  integritySecret: string;
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  /** Hasta cuándo se puede pagar (el fin del tiempo apartado). */
  expiresAt: Date;
  customerEmail?: string | null;
}

/** Campos ocultos del formulario que lleva al checkout de Wompi. */
export function checkoutFields(input: CheckoutInput): Record<string, string> {
  const currency = "COP";
  const expirationTime = input.expiresAt.toISOString();
  const fields: Record<string, string> = {
    "public-key": input.publicKey,
    currency,
    "amount-in-cents": String(input.amountInCents),
    reference: input.reference,
    "signature:integrity": integritySignature({
      reference: input.reference,
      amountInCents: input.amountInCents,
      currency,
      expirationTime,
      integritySecret: input.integritySecret,
    }),
    "redirect-url": input.redirectUrl,
    "expiration-time": expirationTime,
  };
  if (input.customerEmail) fields["customer-data:email"] = input.customerEmail;
  return fields;
}

// ---------------------------------------------------------------------------
// Eventos (webhook)
// ---------------------------------------------------------------------------

export const wompiTransactionSchema = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/),
  status: z.enum(["APPROVED", "DECLINED", "VOIDED", "ERROR", "PENDING"]),
  amount_in_cents: z.number().int().positive(),
  reference: z.string().min(1).max(64),
  currency: z.string().length(3),
  payment_method_type: z.string().max(40).nullish(),
});

export type WompiTransaction = z.infer<typeof wompiTransactionSchema>;

export const wompiEventSchema = z.object({
  event: z.string().max(64),
  data: z.object({ transaction: wompiTransactionSchema }),
  environment: z.enum(["test", "prod"]).optional(),
  signature: z.object({
    properties: z
      .array(z.string().regex(/^[a-z_.]+$/))
      .min(1)
      .max(10),
    checksum: z.string().regex(/^[0-9a-fA-F]{64}$/),
  }),
  timestamp: z.number().int(),
});

export type WompiEvent = z.infer<typeof wompiEventSchema>;

/** Lee un valor anidado del evento, ej.: "transaction.amount_in_cents". */
function readPath(data: unknown, path: string): string {
  let current: unknown = data;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return current === null || current === undefined ? "" : String(current);
}

/** Calcula el checksum de un evento: SHA256(valores de las propiedades + timestamp + secreto). */
export function eventChecksum(
  event: Pick<WompiEvent, "data" | "signature" | "timestamp">,
  eventsSecret: string,
): string {
  const values = event.signature.properties.map((path) => readPath(event.data, path)).join("");
  return sha256(`${values}${event.timestamp}${eventsSecret}`);
}

/**
 * ¿El evento lo firmó Wompi? La comparación es en tiempo constante para no dar
 * pistas a quien intente adivinar la firma.
 */
export function verifyEventSignature(event: WompiEvent, eventsSecret: string): boolean {
  // Debe firmar al menos los datos que vamos a usar.
  const required = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  if (!required.every((p) => event.signature.properties.includes(p))) return false;

  const expected = Buffer.from(eventChecksum(event, eventsSecret), "hex");
  const received = Buffer.from(event.signature.checksum.toLowerCase(), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Llave de idempotencia: un mismo estado de una transacción se aplica una sola vez. */
export function eventKey(transaction: Pick<WompiTransaction, "id" | "status">): string {
  return `wompi:${transaction.id}:${transaction.status}`;
}

/**
 * Consulta una transacción directo en la API de Wompi (respaldo cuando el
 * webhook aún no ha llegado). La respuesta viene de Wompi por HTTPS, así que
 * es tan confiable como el webhook.
 */
export async function fetchWompiTransaction(
  mode: WompiMode,
  transactionId: string,
): Promise<WompiTransaction | null> {
  if (!/^[\w-]{1,64}$/.test(transactionId)) return null;
  try {
    const res = await fetch(
      `${wompiApiBase(mode)}/transactions/${encodeURIComponent(transactionId)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const parsed = z.object({ data: wompiTransactionSchema }).safeParse(body);
    return parsed.success ? parsed.data.data : null;
  } catch (error) {
    console.error("No se pudo consultar la transacción en Wompi", error);
    return null;
  }
}
