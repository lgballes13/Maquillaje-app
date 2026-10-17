import { describe, expect, it } from "vitest";
import {
  addDays,
  isDateString,
  minutesToTime,
  timeToMinutes,
  toZonedDateString,
  weekdayOf,
  zonedDateTimeToUtc,
} from "./time";

describe("zonedDateTimeToUtc", () => {
  it("Bogotá está 5 horas detrás de UTC", () => {
    expect(zonedDateTimeToUtc("2026-10-20", "10:30", "America/Bogota").toISOString()).toBe(
      "2026-10-20T15:30:00.000Z",
    );
  });

  it("una hora de la noche en Bogotá ya es el día siguiente en UTC", () => {
    expect(zonedDateTimeToUtc("2026-10-20", "21:00", "America/Bogota").toISOString()).toBe(
      "2026-10-21T02:00:00.000Z",
    );
  });

  it("respeta el cambio de horario en zonas que lo tienen", () => {
    // Nueva York: invierno UTC-5, verano UTC-4.
    expect(zonedDateTimeToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
    expect(zonedDateTimeToUtc("2026-07-15", "09:00", "America/New_York").toISOString()).toBe(
      "2026-07-15T13:00:00.000Z",
    );
  });

  it("rechaza fechas u horas inválidas", () => {
    expect(() => zonedDateTimeToUtc("2026-02-30", "10:00", "America/Bogota")).toThrow();
    expect(() => zonedDateTimeToUtc("2026-10-20", "25:00", "America/Bogota")).toThrow();
  });
});

describe("toZonedDateString", () => {
  it("usa la fecha de Bogotá, no la de UTC", () => {
    // 02:00 UTC del 21 = 21:00 del 20 en Bogotá.
    expect(toZonedDateString(new Date("2026-10-21T02:00:00Z"), "America/Bogota")).toBe(
      "2026-10-20",
    );
  });
});

describe("utilidades de fecha", () => {
  it("valida fechas AAAA-MM-DD reales", () => {
    expect(isDateString("2026-10-20")).toBe(true);
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("20-10-2026")).toBe(false);
  });

  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula el día de la semana (0 = domingo)", () => {
    expect(weekdayOf("2026-10-18")).toBe(0);
    expect(weekdayOf("2026-10-19")).toBe(1);
  });

  it("convierte horas a minutos y de vuelta", () => {
    expect(timeToMinutes("09:30:00")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
  });
});
