import { describe, expect, it } from "vitest";
import { bookingSchema, dateParamSchema } from "./schemas";

const form = {
  serviceId: "5b7f2a3e-8c1d-4e5f-9a0b-1c2d3e4f5a6b",
  startsAt: "2026-10-20T15:00:00.000Z",
  rulesVersion: "3",
  acceptPolicy: "on",
  notes: "  ",
};

describe("bookingSchema", () => {
  it("acepta una reserva válida y limpia las notas vacías", () => {
    expect(bookingSchema.parse(form)).toEqual({
      serviceId: form.serviceId,
      startsAt: form.startsAt,
      rulesVersion: 3,
      acceptPolicy: "on",
      notes: undefined,
    });
  });

  it("exige aceptar la política", () => {
    const { acceptPolicy: _omit, ...rest } = form;
    const result = bookingSchema.safeParse(rest);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("aceptar la política");
  });

  it("no acepta montos ni campos extra del navegador", () => {
    const parsed = bookingSchema.parse({ ...form, deposit_cop: "1", price_cop: "1" });
    expect(parsed).not.toHaveProperty("deposit_cop");
    expect(parsed).not.toHaveProperty("price_cop");
  });

  it("rechaza horarios y servicios mal formados", () => {
    expect(bookingSchema.safeParse({ ...form, startsAt: "mañana" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...form, serviceId: "1 or 1=1" }).success).toBe(false);
  });
});

describe("dateParamSchema", () => {
  it("solo acepta fechas reales", () => {
    expect(dateParamSchema.safeParse("2026-10-20").success).toBe(true);
    expect(dateParamSchema.safeParse("2026-13-01").success).toBe(false);
    expect(dateParamSchema.safeParse(["2026-10-20"]).success).toBe(false);
  });
});
