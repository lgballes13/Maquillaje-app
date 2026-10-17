import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  checkoutFields,
  eventKey,
  integritySignature,
  verifyEventSignature,
  wompiApiBase,
  wompiEventSchema,
  wompiMode,
  type WompiEvent,
} from "./wompi";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("firma de integridad del checkout", () => {
  it("firma referencia + monto + moneda + expiración + secreto, en ese orden", () => {
    expect(
      integritySignature({
        reference: "CITA-ABC",
        amountInCents: 9000000,
        currency: "COP",
        expirationTime: "2026-10-20T15:10:00.000Z",
        integritySecret: "test_integrity_x",
      }),
    ).toBe(sha256("CITA-ABC9000000COP2026-10-20T15:10:00.000Ztest_integrity_x"));
  });

  it("sin expiración, la firma no la incluye", () => {
    expect(
      integritySignature({
        reference: "R1",
        amountInCents: 100,
        currency: "COP",
        integritySecret: "s",
      }),
    ).toBe(sha256("R1100COPs"));
  });

  it("arma los campos del formulario con la firma que corresponde al monto", () => {
    const fields = checkoutFields({
      publicKey: "pub_test_x",
      integritySecret: "test_integrity_x",
      reference: "CITA-ABC",
      amountInCents: 9000000,
      redirectUrl: "https://ejemplo.com/citas/1",
      expiresAt: new Date("2026-10-20T15:10:00Z"),
      customerEmail: "ana@ejemplo.com",
    });
    expect(fields).toMatchObject({
      "public-key": "pub_test_x",
      currency: "COP",
      "amount-in-cents": "9000000",
      reference: "CITA-ABC",
      "redirect-url": "https://ejemplo.com/citas/1",
      "expiration-time": "2026-10-20T15:10:00.000Z",
      "customer-data:email": "ana@ejemplo.com",
    });
    expect(fields["signature:integrity"]).toBe(
      sha256("CITA-ABC9000000COP2026-10-20T15:10:00.000Ztest_integrity_x"),
    );
  });
});

function signedEvent(overrides: { amount?: number; secret?: string } = {}): WompiEvent {
  const tx = {
    id: "1234-1610641025-49201",
    status: "APPROVED" as const,
    amount_in_cents: overrides.amount ?? 9000000,
    reference: "CITA-ABC",
    currency: "COP",
    payment_method_type: "NEQUI",
  };
  const timestamp = 1760970000;
  const checksum = sha256(
    `${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${overrides.secret ?? "test_events_x"}`,
  );
  return {
    event: "transaction.updated",
    environment: "test",
    data: { transaction: tx },
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum,
    },
    timestamp,
  };
}

describe("verificación de eventos (webhook)", () => {
  it("acepta un evento firmado con el secreto correcto", () => {
    expect(verifyEventSignature(signedEvent(), "test_events_x")).toBe(true);
  });

  it("acepta el checksum en mayúsculas", () => {
    const event = signedEvent();
    event.signature.checksum = event.signature.checksum.toUpperCase();
    expect(verifyEventSignature(event, "test_events_x")).toBe(true);
  });

  it("rechaza un evento firmado con otro secreto", () => {
    expect(verifyEventSignature(signedEvent({ secret: "otro" }), "test_events_x")).toBe(false);
  });

  it("rechaza un evento al que le cambiaron el monto después de firmarlo", () => {
    const event = signedEvent();
    event.data.transaction.amount_in_cents = 100;
    expect(verifyEventSignature(event, "test_events_x")).toBe(false);
  });

  it("rechaza un evento que no firma el estado de la transacción", () => {
    const event = signedEvent();
    event.signature.properties = ["transaction.id", "transaction.amount_in_cents"];
    expect(verifyEventSignature(event, "test_events_x")).toBe(false);
  });

  it("valida la forma del evento", () => {
    expect(wompiEventSchema.safeParse(signedEvent()).success).toBe(true);
    expect(wompiEventSchema.safeParse({ event: "x" }).success).toBe(false);
    const badId = signedEvent();
    badId.data.transaction.id = "../../etc";
    expect(wompiEventSchema.safeParse(badId).success).toBe(false);
  });

  it("la llave de idempotencia depende de la transacción y su estado", () => {
    expect(eventKey({ id: "t1", status: "APPROVED" })).toBe("wompi:t1:APPROVED");
  });
});

describe("ambientes", () => {
  it("distingue pruebas de producción por la llave pública", () => {
    expect(wompiMode("pub_test_abc")).toBe("test");
    expect(wompiMode("pub_prod_abc")).toBe("prod");
    expect(wompiApiBase("test")).toBe("https://sandbox.wompi.co/v1");
    expect(wompiApiBase("prod")).toBe("https://production.wompi.co/v1");
  });
});
