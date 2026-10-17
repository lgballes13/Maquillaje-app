import "server-only";
import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { addDays, weekdayOf, zonedDateTimeToUtc } from "@/lib/time";
import { buildAgendaDay, type AgendaEntry } from "./agenda";
import { reportSchema, type Report } from "./reports";

/*
 * Consultas del panel. Todas pasan por RLS o por funciones que exigen admin con
 * 2FA (admin_customers, admin_report), así que fuera del panel no devuelven nada.
 */

/** Estados que ocupan la agenda (lo cancelado, vencido o reprogramado no se muestra). */
export const AGENDA_STATUSES = ["pending_payment", "confirmed", "completed", "no_show"] as const;

export interface AgendaDay {
  date: string;
  isOpen: boolean;
  entries: AgendaEntry[];
}

export async function getAgenda(days: string[]) {
  const supabase = await createClient();
  const from = zonedDateTimeToUtc(days[0]!, "00:00", siteConfig.timeZone).toISOString();
  const to = zonedDateTimeToUtc(
    addDays(days.at(-1)!, 1),
    "00:00",
    siteConfig.timeZone,
  ).toISOString();

  const [{ data: appointments }, { data: blocks }, { data: hours }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, customer_id, service_name, starts_at, ends_at, status")
      .in("status", [...AGENDA_STATUSES])
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at")
      .limit(500),
    supabase
      .from("blocked_periods")
      .select("id, starts_at, ends_at, reason")
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at"),
    supabase.from("business_hours").select("weekday, is_open, opens_at, closes_at"),
  ]);

  const customerIds = [...new Set((appointments ?? []).map((a) => a.customer_id))];
  const { data: profiles } = customerIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds)
    : { data: [] };

  const hoursByWeekday = new Map((hours ?? []).map((h) => [h.weekday, h]));
  const agendaDays: AgendaDay[] = days.map((date) => {
    const h = hoursByWeekday.get(weekdayOf(date));
    return {
      date,
      isOpen: Boolean(h?.is_open),
      entries: buildAgendaDay({
        date,
        timeZone: siteConfig.timeZone,
        hours: h ? { isOpen: h.is_open, opensAt: h.opens_at, closesAt: h.closes_at } : undefined,
        appointments: (appointments ?? []).map((a) => ({
          id: a.id,
          startsAt: a.starts_at,
          endsAt: a.ends_at,
          serviceName: a.service_name,
          status: a.status,
          customerId: a.customer_id,
        })),
        blocks: (blocks ?? []).map((b) => ({
          id: b.id,
          startsAt: b.starts_at,
          endsAt: b.ends_at,
          reason: b.reason,
        })),
      }),
    };
  });

  return { days: agendaDays, profiles: new Map((profiles ?? []).map((p) => [p.id, p])) };
}

export async function getCustomers(search: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_customers", {
    p_search: search || undefined,
    p_limit: limit,
  });
  if (error) throw new Error(`No se pudo consultar la lista de clientas: ${error.message}`);
  return data;
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("admin_customers", { p_customer_id: id });
  if (error) throw new Error(`No se pudo consultar la clienta: ${error.message}`);
  const customer = rows[0];
  if (!customer) return null;

  const [{ data: appointments }, { data: orders }, { data: credit }, { data: note }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, service_name, starts_at, status, deposit_cop, price_cop")
        .eq("customer_id", id)
        .neq("status", "expired")
        .order("starts_at", { ascending: false })
        .limit(50),
      supabase
        .from("orders")
        .select("id, number, kind, status, total_cop, created_at")
        .eq("customer_id", id)
        .neq("status", "expired")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("credit_movements")
        .select("id, amount_cop, reason, created_at, expires_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("customer_notes")
        .select("note, updated_at")
        .eq("customer_id", id)
        .maybeSingle(),
    ]);

  return {
    customer,
    appointments: appointments ?? [],
    orders: orders ?? [],
    credit: credit ?? [],
    note,
  };
}

export async function getReport(from: string, to: string): Promise<Report> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report", { p_from: from, p_to: to });
  if (error) throw new Error(`No se pudo calcular el reporte: ${error.message}`);
  return reportSchema.parse(data);
}
