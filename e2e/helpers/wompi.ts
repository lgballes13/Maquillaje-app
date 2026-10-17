import { createHash } from "node:crypto";

/**
 * Llaves de Wompi DE MENTIRA para las pruebas E2E. La app se levanta con ellas
 * y las pruebas simulan los avisos de pago de Wompi firmándolos con el mismo
 * secreto. Nunca pongas aquí llaves reales.
 */
export const WOMPI_TEST = {
  publicKey: "pub_test_e2e",
  integritySecret: "test_integrity_e2e",
  eventsSecret: "test_events_e2e",
};

interface FakeTransaction {
  id: string;
  reference: string;
  amountInCents: number;
  status: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED" | "ERROR";
}

/** Arma un evento transaction.updated firmado como lo haría Wompi. */
export function signedWompiEvent(tx: FakeTransaction, secret = WOMPI_TEST.eventsSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const checksum = createHash("sha256")
    .update(`${tx.id}${tx.status}${tx.amountInCents}${timestamp}${secret}`)
    .digest("hex");
  return {
    event: "transaction.updated",
    environment: "test",
    data: {
      transaction: {
        id: tx.id,
        status: tx.status,
        amount_in_cents: tx.amountInCents,
        reference: tx.reference,
        currency: "COP",
        payment_method_type: "CARD",
      },
    },
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum,
    },
    timestamp,
    sent_at: new Date().toISOString(),
  };
}
