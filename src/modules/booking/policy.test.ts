import { describe, expect, it } from "vitest";
import {
  bookingErrorMessage,
  depositFor,
  displayStatus,
  formatCop,
  formatDuration,
  policyPoints,
} from "./policy";

const rules = {
  deposit_percent: "50.00",
  free_cancellation_hours: 48,
  reschedule_window_hours: 24,
  reschedule_penalty_percent: "30.00",
  booking_hold_minutes: 10,
};

describe("depositFor", () => {
  it("calcula el porcentaje del precio", () => {
    expect(depositFor(180000, 50)).toBe(90000);
    expect(depositFor(180000, "50.00")).toBe(90000);
  });

  it("redondea hacia arriba al peso (igual que la base de datos)", () => {
    expect(depositFor(100001, 50)).toBe(50001);
    expect(depositFor(100000, 33.33)).toBe(33330);
    expect(depositFor(99999, 33.33)).toBe(33330);
  });

  it("0 % no cobra anticipo y 100 % cobra todo", () => {
    expect(depositFor(180000, 0)).toBe(0);
    expect(depositFor(180000, 100)).toBe(180000);
  });
});

describe("formatos", () => {
  it("muestra pesos sin decimales", () => {
    expect(formatCop(90000)).toBe("$ 90.000");
  });

  it("muestra la duración en horas y minutos", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(150)).toBe("2 h 30 min");
  });
});

describe("policyPoints", () => {
  it("explica anticipo, tiempo para pagar, cancelación y reprogramación", () => {
    const points = policyPoints(rules).join(" ");
    expect(points).toContain("50 %");
    expect(points).toContain("10 minutos");
    expect(points).toContain("48 horas");
    expect(points).toContain("24 horas");
    expect(points).toContain("30 %");
  });

  it("sin anticipo, lo dice y no habla de pagos", () => {
    expect(policyPoints({ ...rules, deposit_percent: 0 })).toEqual([
      "Esta reserva no requiere anticipo.",
    ]);
  });
});

describe("bookingErrorMessage", () => {
  it("traduce los códigos de la base de datos", () => {
    expect(bookingErrorMessage("slot_unavailable")).toContain("Alguien acaba de tomar");
  });

  it("usa un mensaje genérico para errores desconocidos", () => {
    expect(bookingErrorMessage("duplicate key value")).toContain("No pudimos completar");
    expect(bookingErrorMessage(undefined)).toContain("No pudimos completar");
  });
});

describe("displayStatus", () => {
  const now = new Date("2026-10-20T15:00:00Z");

  it("muestra como vencida una cita cuyo tiempo para pagar pasó", () => {
    expect(
      displayStatus({ status: "pending_payment", hold_expires_at: "2026-10-20T14:59:00Z" }, now),
    ).toBe("expired");
  });

  it("deja igual las demás", () => {
    expect(
      displayStatus({ status: "pending_payment", hold_expires_at: "2026-10-20T15:05:00Z" }, now),
    ).toBe("pending_payment");
    expect(displayStatus({ status: "confirmed", hold_expires_at: null }, now)).toBe("confirmed");
  });
});
