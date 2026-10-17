import "server-only";
import { siteConfig } from "@/config/site";
import {
  addDays,
  isDateString,
  toZonedDateString,
  weekdayOf,
  zonedDateTimeToUtc,
} from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { computeSlots, type Slot } from "./slots";

/** Lecturas para las páginas de agendar. Todas pasan por las reglas RLS. */

export async function getActiveServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price_cop")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`No se pudieron cargar los servicios: ${error.message}`);
  return data;
}

export async function getActiveService(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price_cop")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getCurrentRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_rules")
    .select("*")
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(`No se pudieron cargar las reglas: ${error.message}`);
  return data;
}

/** Hoy en la zona del negocio y el último día que se puede reservar. */
export function bookingDateRange(maxDaysAhead: number, now = new Date()) {
  const today = toZonedDateString(now, siteConfig.timeZone);
  return { today, last: addDays(today, maxDaysAhead) };
}

/** Fecha pedida en ?fecha= si es válida y está dentro del rango; si no, hoy. */
export function resolveBookingDate(requested: unknown, range: { today: string; last: string }) {
  return typeof requested === "string" &&
    isDateString(requested) &&
    requested >= range.today &&
    requested <= range.last
    ? requested
    : range.today;
}

/** Saldo a favor de la clienta con sesión (0 si no tiene). */
export async function getMyCreditBalance(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_credit_balance");
  if (error) throw new Error(`No se pudo consultar el saldo a favor: ${error.message}`);
  return data ?? 0;
}

/** Horarios libres de un servicio en una fecha (hora del negocio). */
export async function getSlotsForDate(
  service: { duration_minutes: number },
  date: string,
): Promise<Slot[]> {
  const supabase = await createClient();
  const rules = await getCurrentRules();
  const { data: hours } = await supabase
    .from("business_hours")
    .select("is_open, opens_at, closes_at")
    .eq("weekday", weekdayOf(date))
    .single();
  if (!hours?.is_open) return [];

  // Se consulta un poco antes y después del día para no perder citas que lo rozan.
  const from = zonedDateTimeToUtc(addDays(date, -1), "00:00", siteConfig.timeZone);
  const to = zonedDateTimeToUtc(addDays(date, 2), "00:00", siteConfig.timeZone);
  const { data: busy, error } = await supabase.rpc("get_busy_periods", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(`No se pudo consultar la disponibilidad: ${error.message}`);

  return computeSlots({
    date,
    timeZone: siteConfig.timeZone,
    hours: { isOpen: hours.is_open, opensAt: hours.opens_at, closesAt: hours.closes_at },
    durationMinutes: service.duration_minutes,
    rules: {
      bufferMinutes: rules.buffer_minutes,
      minNoticeHours: rules.min_booking_notice_hours,
      maxDaysAhead: rules.max_booking_days_ahead,
    },
    busy: busy.map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    now: new Date(),
  });
}

/**
 * Una cita de la clienta (RLS: solo la propia, o cualquiera si es admin), con
 * la política que aceptó al reservar y si ya se reprogramó.
 */
export async function getAppointmentWithPolicy(id: string) {
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, service_id, service_name, duration_minutes, price_cop, deposit_cop, deposit_percent, credit_applied_cop, rules_version, starts_at, status, hold_expires_at, customer_notes, rescheduled_from",
    )
    .eq("id", id)
    .maybeSingle();
  if (!appointment) return null;

  const [{ data: rules }, { data: next }] = await Promise.all([
    supabase
      .from("business_rules")
      .select("free_cancellation_hours, reschedule_window_hours, reschedule_penalty_percent")
      .eq("version", appointment.rules_version)
      .single(),
    supabase.from("appointments").select("id").eq("rescheduled_from", id).maybeSingle(),
  ]);
  if (!rules) throw new Error("No se encontró la política aceptada en la cita");

  return { appointment, rules, rescheduled: next !== null, rescheduledTo: next?.id ?? null };
}
