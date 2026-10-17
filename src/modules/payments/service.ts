import "server-only";
import { publicEnv } from "@/lib/env";
import { getWompiSecrets } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventKey, wompiMode, type WompiMode, type WompiTransaction } from "./wompi";

export interface WompiConfig {
  publicKey: string;
  mode: WompiMode;
  integritySecret: string;
  eventsSecret: string;
}

/** Configuración completa de Wompi, o null si falta algo (no se muestran pagos). */
export function getWompiConfig(): WompiConfig | null {
  const publicKey = publicEnv.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
  const secrets = getWompiSecrets();
  if (!publicKey || !secrets) return null;

  const mode = wompiMode(publicKey);
  // Evita mezclar llaves de pruebas con secretos de producción (o al revés).
  if (!secrets.WOMPI_INTEGRITY_SECRET.startsWith(`${mode}_`)) {
    console.error(
      "La llave pública y el secreto de integridad de Wompi son de ambientes distintos.",
    );
    return null;
  }
  return {
    publicKey,
    mode,
    integritySecret: secrets.WOMPI_INTEGRITY_SECRET,
    eventsSecret: secrets.WOMPI_EVENTS_SECRET,
  };
}

/**
 * Aplica el estado de una transacción YA VERIFICADA (firma del webhook o
 * consulta directa a Wompi). La base de datos decide qué hacer con la cita.
 */
export async function applyWompiTransaction(
  source: "webhook" | "api",
  transaction: WompiTransaction,
): Promise<string> {
  const { data, error } = await createAdminClient().rpc("apply_payment_event", {
    p_source: source,
    p_event_key: eventKey(transaction),
    p_reference: transaction.reference,
    p_transaction_id: transaction.id,
    p_status: transaction.status,
    p_amount_in_cents: transaction.amount_in_cents,
    p_currency: transaction.currency,
    p_payment_method: transaction.payment_method_type ?? undefined,
  });
  if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`);
  return data;
}
