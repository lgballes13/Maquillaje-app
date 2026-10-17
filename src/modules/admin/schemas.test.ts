import { describe, expect, it } from "vitest";
import {
  blockSchema,
  businessRulesSchema,
  parseBusinessHoursForm,
  rulesChanged,
  serviceSchema,
} from "./schemas";

const rulesForm = {
  deposit_percent: "50",
  reschedule_window_hours: "24",
  reschedule_penalty_percent: "30",
  free_cancellation_hours: "48",
  preorder_deposit_percent: "50",
  preorder_delivery_days: "15",
  buffer_minutes: "15",
  booking_hold_minutes: "10",
  min_booking_notice_hours: "12",
  max_booking_days_ahead: "90",
  change_reason: "Ajuste de temporada",
};

describe("businessRulesSchema", () => {
  it("convierte los textos del formulario en números", () => {
    const result = businessRulesSchema.parse(rulesForm);
    expect(result.deposit_percent).toBe(50);
    expect(result.booking_hold_minutes).toBe(10);
  });

  it.each([
    ["deposit_percent", "101", /máximo 100/],
    ["deposit_percent", "-1", /mínimo 0/],
    ["deposit_percent", "12.345", /dos decimales/],
    ["booking_hold_minutes", "4", /mínimo 5/],
    ["buffer_minutes", "10.5", /entero/],
    ["preorder_delivery_days", "abc", /escribe un número/],
  ])("rechaza %s = %s", (field, value, message) => {
    const result = businessRulesSchema.safeParse({ ...rulesForm, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(message);
  });

  it("acepta porcentajes con dos decimales", () => {
    expect(
      businessRulesSchema.parse({ ...rulesForm, deposit_percent: "33.33" }).deposit_percent,
    ).toBe(33.33);
  });

  it("exige un motivo del cambio", () => {
    expect(businessRulesSchema.safeParse({ ...rulesForm, change_reason: "" }).success).toBe(false);
  });
});

describe("rulesChanged", () => {
  const next = businessRulesSchema.parse(rulesForm);
  // Postgres devuelve los numeric como texto ("50.00"): deben compararse como números.
  const current = { ...next, deposit_percent: "50.00", reschedule_penalty_percent: "30.00" };

  it("no hay cambios si los valores son iguales", () => {
    expect(rulesChanged(current, next)).toBe(false);
  });

  it("detecta un cambio en cualquier regla", () => {
    expect(rulesChanged(current, { ...next, buffer_minutes: 20 })).toBe(true);
  });
});

describe("parseBusinessHoursForm", () => {
  function form(entries: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  }

  it("un día sin la casilla marcada queda cerrado", () => {
    const result = parseBusinessHoursForm(form({}));
    expect(result.success).toBe(true);
    expect(result.data?.every((day) => !day.is_open)).toBe(true);
  });

  it("lee un día abierto con su horario", () => {
    const result = parseBusinessHoursForm(
      form({ "open-1": "on", "opens-1": "09:00", "closes-1": "18:00" }),
    );
    expect(result.data?.[1]).toEqual({
      weekday: 1,
      is_open: true,
      opens_at: "09:00",
      closes_at: "18:00",
    });
  });

  it("rechaza un horario que cierra antes de abrir", () => {
    const result = parseBusinessHoursForm(
      form({ "open-2": "on", "opens-2": "18:00", "closes-2": "09:00" }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([2, "closes_at"]);
  });

  it("rechaza un día abierto sin horas", () => {
    expect(parseBusinessHoursForm(form({ "open-3": "on" })).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  const form = {
    id: "",
    name: "Peinado",
    description: "",
    duration_minutes: "60",
    price_cop: "90000",
    sort_order: "0",
    is_active: "on",
  };

  it("convierte el formulario (servicio nuevo, visible)", () => {
    expect(serviceSchema.parse(form)).toEqual({
      id: undefined,
      name: "Peinado",
      description: null,
      duration_minutes: 60,
      price_cop: 90000,
      sort_order: 0,
      is_active: true,
    });
  });

  it("una casilla sin marcar oculta el servicio", () => {
    const { is_active: _omit, ...rest } = form;
    expect(serviceSchema.parse(rest).is_active).toBe(false);
  });

  it.each([
    ["duration_minutes", "10"],
    ["price_cop", "500"],
    ["name", "ab"],
  ])("rechaza %s = %s", (field, value) => {
    expect(serviceSchema.safeParse({ ...form, [field]: value }).success).toBe(false);
  });
});

describe("blockSchema", () => {
  it("acepta fechas y horas válidas", () => {
    expect(
      blockSchema.safeParse({
        startDate: "2026-12-24",
        startTime: "00:00",
        endDate: "2026-12-26",
        endTime: "23:59",
        reason: "",
      }).success,
    ).toBe(true);
  });

  it("rechaza horas inválidas", () => {
    expect(
      blockSchema.safeParse({
        startDate: "2026-12-24",
        startTime: "24:00",
        endDate: "2026-12-26",
        endTime: "23:59",
      }).success,
    ).toBe(false);
  });
});
