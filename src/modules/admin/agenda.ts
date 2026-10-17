import { addDays, isDateString, weekdayOf, zonedDateTimeToUtc } from "@/lib/time";

/*
 * Agenda del panel: arma el día con citas, bloqueos y horas libres. Funciones
 * puras para poder probarlas sin base de datos.
 */

export type AgendaView = "dia" | "semana";

export interface AgendaRange {
  view: AgendaView;
  /** Fecha elegida (AAAA-MM-DD, hora del negocio). */
  date: string;
  /** Días que se muestran: uno en vista día, de lunes a domingo en vista semana. */
  days: string[];
  previous: string;
  next: string;
}

/** Lunes de la semana de `date`. */
export function weekStart(date: string): string {
  const weekday = weekdayOf(date);
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export function resolveAgendaRange(
  params: { vista?: string | string[]; fecha?: string | string[] },
  today: string,
): AgendaRange {
  const view: AgendaView = params.vista === "semana" ? "semana" : "dia";
  const date =
    typeof params.fecha === "string" && isDateString(params.fecha) ? params.fecha : today;
  if (view === "dia") {
    return { view, date, days: [date], previous: addDays(date, -1), next: addDays(date, 1) };
  }
  const monday = weekStart(date);
  return {
    view,
    date,
    days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    previous: addDays(monday, -7),
    next: addDays(monday, 7),
  };
}

export interface AgendaHours {
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface AgendaAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  status: string;
  customerId: string;
}

export interface AgendaBlock {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export type AgendaEntry =
  | { kind: "appointment"; start: Date; end: Date; appointment: AgendaAppointment }
  | { kind: "block"; start: Date; end: Date; block: AgendaBlock }
  | { kind: "free"; start: Date; end: Date };

/** Las horas libres más cortas que esto no se muestran (no cabe ningún servicio). */
export const MIN_FREE_MINUTES = 30;

function overlaps(start: Date, end: Date, from: Date, to: Date): boolean {
  return start < to && end > from;
}

/**
 * Lo que pasa en un día, en orden: citas y bloqueos que lo tocan, y los huecos
 * libres dentro del horario de atención.
 */
export function buildAgendaDay({
  date,
  timeZone,
  hours,
  appointments,
  blocks,
}: {
  date: string;
  timeZone: string;
  hours: AgendaHours | undefined;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
}): AgendaEntry[] {
  const dayStart = zonedDateTimeToUtc(date, "00:00", timeZone);
  const dayEnd = zonedDateTimeToUtc(addDays(date, 1), "00:00", timeZone);

  const entries: AgendaEntry[] = [];
  for (const appointment of appointments) {
    const start = new Date(appointment.startsAt);
    const end = new Date(appointment.endsAt);
    if (overlaps(start, end, dayStart, dayEnd)) {
      entries.push({ kind: "appointment", start, end, appointment });
    }
  }
  for (const block of blocks) {
    const start = new Date(block.startsAt);
    const end = new Date(block.endsAt);
    if (overlaps(start, end, dayStart, dayEnd)) entries.push({ kind: "block", start, end, block });
  }

  if (hours?.isOpen && hours.opensAt && hours.closesAt) {
    const opens = zonedDateTimeToUtc(date, hours.opensAt.slice(0, 5), timeZone);
    const closes = zonedDateTimeToUtc(date, hours.closesAt.slice(0, 5), timeZone);
    const busy = entries
      .map((e) => ({ start: e.start, end: e.end }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    let cursor = opens;
    for (const period of [...busy, { start: closes, end: closes }]) {
      const gapEnd = period.start < closes ? period.start : closes;
      if (gapEnd.getTime() - cursor.getTime() >= MIN_FREE_MINUTES * 60 * 1000) {
        entries.push({ kind: "free", start: cursor, end: gapEnd });
      }
      if (period.end > cursor) cursor = period.end;
      if (cursor >= closes) break;
    }
  }

  return entries.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  );
}
