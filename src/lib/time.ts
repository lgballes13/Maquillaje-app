/**
 * Fechas y horas en la zona horaria del negocio.
 *
 * El servidor (Vercel) corre en UTC y el navegador de la clienta puede estar en
 * cualquier zona; por eso nunca usamos la hora "local" de la máquina. Una fecha
 * del negocio se escribe como texto "AAAA-MM-DD" y una hora como "HH:MM".
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Diferencia (en ms) entre la hora de `timeZone` y UTC en ese instante. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-10-20" + "10:30" en Bogotá → instante exacto (Date en UTC). */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  if (!isDateString(date) || !TIME_RE.test(time)) throw new Error("Fecha u hora inválida");
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Dos pasadas para acertar también en zonas con cambio de horario.
  const first = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - timeZoneOffsetMs(new Date(first), timeZone));
}

/** Instante → fecha "AAAA-MM-DD" en la zona del negocio. */
export function toZonedDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Suma días a una fecha "AAAA-MM-DD". */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (igual que la tabla business_hours). */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** "09:30" o "09:30:00" → minutos desde la medianoche. */
export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return hh * 60 + mm;
}

export function minutesToTime(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
