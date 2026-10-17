import { describe, expect, it } from "vitest";
import {
  displayOrderStatus,
  isBalanceOverdue,
  nextOrderActions,
  preorderDeposit,
  preorderTerms,
  purchaseTerms,
  shopErrorMessage,
} from "./labels";

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

describe("preventa", () => {
  const now = new Date("2026-10-17T15:00:00Z");

  it("una preventa con anticipo puede marcarse como llegada o cancelarse", () => {
    expect(nextOrderActions({ status: "deposit_paid", delivery_method: "pickup" })).toEqual([
      "arrived",
      "cancelled",
    ]);
    expect(nextOrderActions({ status: "awaiting_balance", delivery_method: "shipping" })).toEqual([
      "cancelled",
    ]);
  });

  it("si venció el plazo del saldo, la preventa se ve cancelada", () => {
    const order = {
      status: "awaiting_balance" as const,
      hold_expires_at: null,
      balance_due_at: "2026-10-17T14:00:00Z",
    };
    expect(isBalanceOverdue(order, now)).toBe(true);
    expect(displayOrderStatus(order, now)).toBe("cancelled");
    const onTime = { ...order, balance_due_at: "2026-10-20T14:00:00Z" };
    expect(isBalanceOverdue(onTime, now)).toBe(false);
    expect(displayOrderStatus(onTime, now)).toBe("awaiting_balance");
  });

  it("el anticipo se redondea hacia arriba al peso, igual que la base de datos", () => {
    expect(preorderDeposit(100000, 50)).toBe(50000);
    expect(preorderDeposit(33333, 50)).toBe(16667);
    expect(preorderDeposit(45000, 33.33)).toBe(14999);
    expect(preorderDeposit(45000, 0)).toBe(0);
  });

  it("las condiciones informan anticipo, tiempo estimado, plazo del saldo y retracto", () => {
    const text = preorderTerms({
      depositPercent: 50,
      deliveryDays: 15,
      balanceDays: 7,
      creditValidityDays: 15,
      holdMinutes: 10,
    }).join(" ");
    expect(text).toContain("anticipo del 50 %");
    expect(text).toContain("15 días");
    expect(text).toContain("tienes 7 días para pagar el saldo");
    expect(text).toContain("saldo a favor");
    expect(text).toContain("retracto");
  });

  it("explica los errores de la reserva", () => {
    expect(shopErrorMessage("in_stock")).toMatch(/unidades disponibles/);
    expect(shopErrorMessage("preorder_unavailable")).toMatch(/no se puede reservar/);
  });
});
