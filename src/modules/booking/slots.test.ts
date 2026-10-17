import { describe, expect, it } from "vitest";
import { computeSlots, type SlotInput } from "./slots";

const TZ = "America/Bogota";
// Martes 20 de octubre de 2026. "Ahora" = 5 días antes, para que la anticipación no moleste.
const base: SlotInput = {
  date: "2026-10-20",
  timeZone: TZ,
  hours: { isOpen: true, opensAt: "09:00:00", closesAt: "13:00:00" },
  durationMinutes: 90,
  rules: { bufferMinutes: 15, minNoticeHours: 12, maxDaysAhead: 90 },
  busy: [],
  now: new Date("2026-10-15T12:00:00Z"),
};

const times = (input: Partial<SlotInput>) => computeSlots({ ...base, ...input }).map((s) => s.time);

describe("computeSlots", () => {
  it("ofrece horarios cada 30 minutos que terminen antes del cierre", () => {
    // 90 min: la última que cabe antes de las 13:00 empieza a las 11:30.
    expect(times({})).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("devuelve la hora exacta en UTC", () => {
    expect(computeSlots(base)[0]?.startsAt.toISOString()).toBe("2026-10-20T14:00:00.000Z");
  });

  it("no ofrece nada si el día está cerrado", () => {
    expect(times({ hours: { isOpen: false, opensAt: null, closesAt: null } })).toEqual([]);
  });

  it("quita los horarios que se cruzan con una cita (incluida su preparación)", () => {
    // Cita ocupada de 10:00 a 11:30 + 15 min de preparación = libre desde 11:45.
    const busy = [
      { start: new Date("2026-10-20T15:00:00Z"), end: new Date("2026-10-20T16:45:00Z") },
    ];
    // Con 90 min no cabe nada: 9:00 terminaría (con preparación) a las 10:45 y 11:30 empieza antes de las 11:45.
    expect(times({ busy })).toEqual([]);
    // Con 45 min sí: 9:00 (libera a las 10:00 justas) y 12:00.
    expect(times({ busy, durationMinutes: 45 })).toEqual(["09:00", "12:00"]);
  });

  it("deja libre el horario que empieza justo cuando termina lo ocupado", () => {
    const busy = [
      { start: new Date("2026-10-20T14:00:00Z"), end: new Date("2026-10-20T15:00:00Z") },
    ];
    expect(
      times({ busy, durationMinutes: 60, rules: { ...base.rules, bufferMinutes: 0 } }),
    ).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00"]);
  });

  it("respeta la anticipación mínima", () => {
    // Ahora son las 8:00 de Bogotá del mismo día y se exigen 3 horas: desde las 11:00.
    expect(
      times({
        now: new Date("2026-10-20T13:00:00Z"),
        rules: { ...base.rules, minNoticeHours: 3 },
      }),
    ).toEqual(["11:00", "11:30"]);
  });

  it("no ofrece fechas más allá del máximo de días", () => {
    expect(times({ rules: { ...base.rules, maxDaysAhead: 2 } })).toEqual([]);
  });

  it("si abre a una hora rara, arranca en el siguiente múltiplo de 5 minutos", () => {
    expect(times({ hours: { isOpen: true, opensAt: "09:07", closesAt: "11:00" } })).toEqual([
      "09:10",
    ]);
  });
});
