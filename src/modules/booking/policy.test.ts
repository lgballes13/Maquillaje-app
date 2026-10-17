import { describe, expect, it } from "vitest";
import {
  amountDueToday,
  availableAction,
  cancellationPreview,
  penaltyFor,
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

const lifecycle = {
  free_cancellation_hours: 48,
  reschedule_window_hours: 24,
  reschedule_penalty_percent: 30,
};
const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-20T15:00:00Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * HOUR).toISOString();

describe("penaltyFor", () => {
  it("redondea hacia arriba al peso, como la base de datos", () => {
    expect(penaltyFor(90000, 30)).toBe(27000);
    expect(penaltyFor(55001, 30)).toBe(16501);
  });
});

describe("cancellationPreview", () => {
  it("con anticipación, todo el anticipo queda a favor", () => {
    expect(
      cancellationPreview({ starts_at: inHours(48), deposit_cop: 90000 }, lifecycle, NOW),
    ).toEqual({ late: false, penalty: 0, credit: 90000 });
  });

  it("tarde, se descuenta el porcentaje y el resto queda a favor", () => {
    expect(
      cancellationPreview({ starts_at: inHours(47.9), deposit_cop: 90000 }, lifecycle, NOW),
    ).toEqual({ late: true, penalty: 27000, credit: 63000 });
  });
});

describe("availableAction", () => {
  const base = {
    deposit_cop: 90000,
    hold_expires_at: null,
    rescheduled: false,
  };

  it("pendiente de pago: pagar", () => {
    expect(
      availableAction(
        {
          ...base,
          status: "pending_payment",
          starts_at: inHours(72),
          hold_expires_at: inHours(0.1),
        },
        lifecycle,
        NOW,
      ),
    ).toEqual({ kind: "pay" });
  });

  it("pendiente con el tiempo vencido: nada", () => {
    expect(
      availableAction(
        {
          ...base,
          status: "pending_payment",
          starts_at: inHours(72),
          hold_expires_at: inHours(-0.1),
        },
        lifecycle,
        NOW,
      ).kind,
    ).toBe("none");
  });

  it("confirmada con anticipación: cambiar o cancelar", () => {
    expect(
      availableAction({ ...base, status: "confirmed", starts_at: inHours(48) }, lifecycle, NOW)
        .kind,
    ).toBe("change");
  });

  it("confirmada con menos de 48 h: solo cancelar", () => {
    expect(
      availableAction({ ...base, status: "confirmed", starts_at: inHours(5) }, lifecycle, NOW).kind,
    ).toBe("cancel_only");
  });

  it("confirmada que ya empezó: nada", () => {
    expect(
      availableAction({ ...base, status: "confirmed", starts_at: inHours(-1) }, lifecycle, NOW)
        .kind,
    ).toBe("none");
  });

  it("no asistió dentro del plazo: reprogramar con el anticipo menos la penalidad", () => {
    const startsAt = inHours(-23);
    expect(
      availableAction({ ...base, status: "no_show", starts_at: startsAt }, lifecycle, NOW),
    ).toEqual({
      kind: "reschedule_after_no_show",
      credit: 63000,
      deadline: new Date(new Date(startsAt).getTime() + 24 * HOUR),
    });
  });

  it("no asistió fuera del plazo, o ya reprogramada: nada", () => {
    expect(
      availableAction({ ...base, status: "no_show", starts_at: inHours(-25) }, lifecycle, NOW).kind,
    ).toBe("none");
    expect(
      availableAction(
        { ...base, status: "no_show", starts_at: inHours(-2), rescheduled: true },
        lifecycle,
        NOW,
      ).kind,
    ).toBe("none");
  });

  it("canceladas, vencidas, reprogramadas y atendidas: nada", () => {
    for (const status of ["cancelled", "expired", "rescheduled", "completed"] as const) {
      expect(
        availableAction({ ...base, status, starts_at: inHours(72) }, lifecycle, NOW).kind,
      ).toBe("none");
    }
  });
});

describe("amountDueToday", () => {
  it("el saldo cubre lo que alcance del anticipo", () => {
    expect(amountDueToday(90000, 0)).toEqual({ creditApplied: 0, due: 90000 });
    expect(amountDueToday(90000, 63000)).toEqual({ creditApplied: 63000, due: 27000 });
    expect(amountDueToday(90000, 153000)).toEqual({ creditApplied: 90000, due: 0 });
  });

  it("un saldo negativo no aumenta el cobro", () => {
    expect(amountDueToday(90000, -5000)).toEqual({ creditApplied: 0, due: 90000 });
  });
});
