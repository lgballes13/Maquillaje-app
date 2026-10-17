import "server-only";
import { siteConfig } from "@/config/site";
import { addDays, toZonedDateString, weekdayOf, zonedDateTimeToUtc } from "@/lib/time";
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
