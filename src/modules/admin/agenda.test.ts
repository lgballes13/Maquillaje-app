import { describe, expect, it } from "vitest";
import { buildAgendaDay, resolveAgendaRange, weekStart, type AgendaAppointment } from "./agenda";

const TZ = "America/Bogota";
const OPEN = { isOpen: true, opensAt: "09:00:00", closesAt: "18:00:00" };

function appointment(start: string, end: string, id = "a"): AgendaAppointment {
  return {
    id,
    startsAt: start,
    endsAt: end,
    serviceName: "Social",
    status: "confirmed",
    customerId: "c",
  };
}

describe("weekStart", () => {
  it("devuelve el lunes, también desde un domingo", () => {
    expect(weekStart("2026-10-21")).toBe("2026-10-19"); // miércoles
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // lunes
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // domingo
  });
});

describe("resolveAgendaRange", () => {
  it("por defecto muestra el día de hoy", () => {
    const range = resolveAgendaRange({}, "2026-10-21");
    expect(range).toMatchObject({ view: "dia", days: ["2026-10-21"] });
    expect(range.previous).toBe("2026-10-20");
    expect(range.next).toBe("2026-10-22");
  });

  it("la semana va de lunes a domingo y salta de a siete días", () => {
    const range = resolveAgendaRange({ vista: "semana", fecha: "2026-10-23" }, "2026-10-21");
    expect(range.days).toHaveLength(7);
    expect(range.days[0]).toBe("2026-10-19");
    expect(range.days[6]).toBe("2026-10-25");
    expect(range.previous).toBe("2026-10-12");
    expect(range.next).toBe("2026-10-26");
  });

  it("ignora fechas inválidas", () => {
    expect(resolveAgendaRange({ fecha: "2026-02-31" }, "2026-10-21").date).toBe("2026-10-21");
    expect(resolveAgendaRange({ fecha: ["2026-10-01"] }, "2026-10-21").date).toBe("2026-10-21");
  });
});

describe("buildAgendaDay", () => {
  it("día sin citas: todo el horario queda libre", () => {
    const entries = buildAgendaDay({
      date: "2026-10-21",
      timeZone: TZ,
      hours: OPEN,
      appointments: [],
      blocks: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "free" });
    expect(entries[0]!.start.toISOString()).toBe("2026-10-21T14:00:00.000Z");
    expect(entries[0]!.end.toISOString()).toBe("2026-10-21T23:00:00.000Z");
  });

  it("ordena citas, bloqueos y huecos libres", () => {
    const entries = buildAgendaDay({
      date: "2026-10-21",
      timeZone: TZ,
      hours: OPEN,
      appointments: [appointment("2026-10-21T15:00:00Z", "2026-10-21T16:30:00Z")],
      blocks: [
        { id: "b", startsAt: "2026-10-21T19:00:00Z", endsAt: "2026-10-21T21:00:00Z", reason: "x" },
      ],
    });
    expect(entries.map((e) => e.kind)).toEqual([
      "free", // 9:00–10:00
      "appointment", // 10:00–11:30
      "free", // 11:30–14:00
      "block", // 14:00–16:00
      "free", // 16:00–18:00
    ]);
  });

  it("no muestra huecos de menos de 30 minutos", () => {
    const entries = buildAgendaDay({
      date: "2026-10-21",
      timeZone: TZ,
      hours: OPEN,
      appointments: [
        appointment("2026-10-21T14:20:00Z", "2026-10-21T22:45:00Z"), // 9:20 a 17:45
      ],
      blocks: [],
    });
    expect(entries.map((e) => e.kind)).toEqual(["appointment"]);
  });

  it("día cerrado: solo lo que haya, sin horas libres", () => {
    const entries = buildAgendaDay({
      date: "2026-10-25",
      timeZone: TZ,
      hours: { isOpen: false, opensAt: null, closesAt: null },
      appointments: [],
      blocks: [],
    });
    expect(entries).toEqual([]);
  });

  it("incluye un bloqueo de varios días que cubre la fecha", () => {
    const entries = buildAgendaDay({
      date: "2026-10-21",
      timeZone: TZ,
      hours: OPEN,
      appointments: [appointment("2026-10-22T15:00:00Z", "2026-10-22T16:00:00Z")],
      blocks: [
        { id: "b", startsAt: "2026-10-20T05:00:00Z", endsAt: "2026-10-23T04:59:00Z", reason: null },
      ],
    });
    expect(entries.map((e) => e.kind)).toEqual(["block"]);
  });
});
