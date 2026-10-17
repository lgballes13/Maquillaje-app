import { minutesToTime, timeToMinutes, zonedDateTimeToUtc } from "@/lib/time";

/*
 * Cálculo de horarios libres. Es una función "pura" (sin base de datos) para
 * poder probarla a fondo con pruebas unitarias. La base de datos vuelve a
 * validar todo al reservar (create_booking), así que esto solo sirve para
 * MOSTRAR opciones; nunca es la última palabra.
 */

/** Cada cuántos minutos se ofrece un horario (9:00, 9:30, 10:00…). */
export const SLOT_STEP_MINUTES = 30;

export interface DayHours {
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface SlotRules {
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
}

export interface BusyPeriod {
  start: Date;
  end: Date;
}

export interface SlotInput {
  date: string;
  timeZone: string;
  hours: DayHours;
  durationMinutes: number;
  rules: SlotRules;
  busy: BusyPeriod[];
  now: Date;
  stepMinutes?: number;
}

export interface Slot {
  /** Hora local, ej.: "10:30" */
  time: string;
  startsAt: Date;
}

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export function computeSlots({
  date,
  timeZone,
  hours,
  durationMinutes,
  rules,
  busy,
  now,
  stepMinutes = SLOT_STEP_MINUTES,
}: SlotInput): Slot[] {
  if (!hours.isOpen || !hours.opensAt || !hours.closesAt) return [];

  const opens = timeToMinutes(hours.opensAt);
  const closes = timeToMinutes(hours.closesAt);
  const earliest = now.getTime() + rules.minNoticeHours * HOUR;
  const latest = now.getTime() + rules.maxDaysAhead * 24 * HOUR;
  // La base de datos exige minutos múltiplos de 5.
  const first = Math.ceil(opens / 5) * 5;

  const slots: Slot[] = [];
  for (let minute = first; minute + durationMinutes <= closes; minute += stepMinutes) {
    const time = minutesToTime(minute);
    const startsAt = zonedDateTimeToUtc(date, time, timeZone);
    const start = startsAt.getTime();
    if (start < earliest || start > latest) continue;

    // El horario queda ocupado hasta el fin de la cita + la preparación.
    const blockedUntil = start + (durationMinutes + rules.bufferMinutes) * MINUTE;
    const overlaps = busy.some((b) => b.start.getTime() < blockedUntil && start < b.end.getTime());
    if (!overlaps) slots.push({ time, startsAt });
  }
  return slots;
}
