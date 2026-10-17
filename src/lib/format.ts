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
