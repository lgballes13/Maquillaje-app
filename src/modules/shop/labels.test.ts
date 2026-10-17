import { describe, expect, it } from "vitest";
import { displayOrderStatus, nextOrderActions, purchaseTerms, shopErrorMessage } from "./labels";

describe("nextOrderActions", () => {
  it("un pedido pagado se marca listo (recoger) o enviado (envío), o se cancela", () => {
    expect(nextOrderActions({ status: "paid", delivery_method: "pickup" })).toEqual([
      "ready",
      "cancelled",
    ]);
    expect(nextOrderActions({ status: "paid", delivery_method: "shipping" })).toEqual([
      "shipped",
      "cancelled",
    ]);
  });

  it("listo o enviado pasa a entregado; los demás no tienen acciones", () => {
    expect(nextOrderActions({ status: "ready", delivery_method: "pickup" })).toEqual(["delivered"]);
    expect(nextOrderActions({ status: "shipped", delivery_method: "shipping" })).toEqual([
      "delivered",
    ]);
    for (const status of ["pending_payment", "delivered", "cancelled", "expired"] as const) {
      expect(nextOrderActions({ status, delivery_method: "pickup" })).toEqual([]);
    }
  });
});

describe("displayOrderStatus", () => {
  const now = new Date("2026-10-17T15:00:00Z");

  it("un pedido sin pagar cuyo tiempo ya pasó se ve vencido", () => {
    expect(
      displayOrderStatus(
        { status: "pending_payment", hold_expires_at: "2026-10-17T14:59:00Z" },
        now,
      ),
    ).toBe("expired");
    expect(
      displayOrderStatus(
        { status: "pending_payment", hold_expires_at: "2026-10-17T15:05:00Z" },
        now,
      ),
    ).toBe("pending_payment");
    expect(displayOrderStatus({ status: "paid", hold_expires_at: null }, now)).toBe("paid");
  });
});

describe("textos", () => {
  it("traduce los errores de la base y tiene un mensaje por defecto", () => {
    expect(shopErrorMessage("out_of_stock")).toMatch(/unidades suficientes/);
    expect(shopErrorMessage("algo_raro")).toMatch(/No pudimos completar tu pedido/);
    expect(shopErrorMessage(undefined)).toMatch(/No pudimos completar tu pedido/);
  });

  it("la información de compra menciona IVA, tiempo apartado y retracto", () => {
    const terms = purchaseTerms(10).join(" ");
    expect(terms).toMatch(/IVA/);
    expect(terms).toMatch(/10 minutos/);
    expect(terms).toMatch(/retracto/i);
  });
});
