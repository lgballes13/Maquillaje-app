import { siteConfig } from "@/config/site";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: siteConfig.timeZone,
  dateStyle: "medium",
  timeStyle: "short",
});

/** Fecha y hora en la zona horaria del negocio, ej.: "16 oct 2026, 7:30 p. m." */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** "09:00:00" → "09:00" (Postgres devuelve las horas con segundos). */
export function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

const longDateFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const clockFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: siteConfig.timeZone,
  hour: "numeric",
  minute: "2-digit",
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: siteConfig.timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "2026-10-20" → "martes, 20 de octubre" (la fecha ya está en la zona del negocio). */
export function formatLongDate(date: string): string {
  return longDateFormatter.format(new Date(`${date}T12:00:00Z`));
}

/** "2026-10-20" → "mar, 20 oct" */
export function formatShortDate(date: string): string {
  return shortDateFormatter.format(new Date(`${date}T12:00:00Z`));
}

/** Instante → "10:30 a. m." en la hora del negocio. */
export function formatClock(value: string | Date): string {
  return clockFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** Instante → "martes, 20 de octubre de 2026, 10:30 a. m." */
export function formatFullDateTime(value: string | Date): string {
  return fullDateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}
