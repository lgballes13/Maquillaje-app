import "server-only";
import { siteConfig } from "@/config/site";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addDays, zonedDateTimeToUtc } from "@/lib/time";
import { APPOINTMENT_STATUS_LABELS } from "@/modules/booking/policy";
import { DELIVERY_LABELS, ORDER_STATUS_LABELS } from "@/modules/shop/labels";
import { toCsv, type CsvValue } from "./csv";
import { getCustomers, getReport } from "./queries";
import { attendanceRate, totalIncome } from "./reports";

/* Arma cada CSV del panel. Las consultas pasan por RLS / funciones de admin. */

export const EXPORT_KINDS = ["citas", "pedidos", "clientas", "reporte"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/** Máximo de filas por archivo (un año de un estudio cabe de sobra). */
export const MAX_EXPORT_ROWS = 5000;

function rangeToUtc(from: string, to: string) {
  return {
    start: zonedDateTimeToUtc(from, "00:00", siteConfig.timeZone).toISOString(),
    end: zonedDateTimeToUtc(addDays(to, 1), "00:00", siteConfig.timeZone).toISOString(),
  };
}

async function customersById() {
  const customers = await getCustomers("", MAX_EXPORT_ROWS);
  return new Map(customers.map((c) => [c.id, c]));
}

export async function appointmentsCsv(from: string, to: string) {
  const supabase = await createClient();
  const { start, end } = rangeToUtc(from, to);
  const [{ data, error }, customers] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "customer_id, service_name, starts_at, status, price_cop, deposit_cop, customer_notes",
      )
      .gte("starts_at", start)
      .lt("starts_at", end)
      .neq("status", "expired")
      .order("starts_at")
      .limit(MAX_EXPORT_ROWS),
    customersById(),
  ]);
  if (error) throw new Error(error.message);
  const rows: CsvValue[][] = data.map((a) => {
    const c = customers.get(a.customer_id);
    return [
      formatDateTime(a.starts_at),
      a.service_name,
      APPOINTMENT_STATUS_LABELS[a.status],
      c?.full_name,
      c?.email,
      c?.phone,
      a.price_cop,
      a.deposit_cop,
      a.customer_notes,
    ];
  });
  return {
    rows: rows.length,
    csv: toCsv(
      [
        "Fecha",
        "Servicio",
        "Estado",
        "Clienta",
        "Correo",
        "Teléfono",
        "Precio",
        "Anticipo",
        "Notas de la clienta",
      ],
      rows,
    ),
  };
}

export async function ordersCsv(from: string, to: string) {
  const supabase = await createClient();
  const { start, end } = rangeToUtc(from, to);
  const [{ data, error }, customers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "customer_id, number, kind, status, created_at, delivery_method, recipient_name, phone, city, subtotal_cop, shipping_cop, credit_applied_cop, total_cop, order_items(product_name, quantity)",
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .neq("status", "expired")
      .order("created_at")
      .limit(MAX_EXPORT_ROWS),
    customersById(),
  ]);
  if (error) throw new Error(error.message);
  const rows: CsvValue[][] = data.map((o) => [
    o.number,
    formatDateTime(o.created_at),
    o.kind === "preorder" ? "Preventa" : "Compra",
    ORDER_STATUS_LABELS[o.status],
    customers.get(o.customer_id)?.email,
    o.recipient_name,
    o.phone,
    DELIVERY_LABELS[o.delivery_method],
    o.city,
    o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", "),
    o.subtotal_cop,
    o.shipping_cop,
    o.credit_applied_cop,
    o.total_cop,
  ]);
  return {
    rows: rows.length,
    csv: toCsv(
      [
        "Número",
        "Fecha",
        "Tipo",
        "Estado",
        "Correo de la clienta",
        "Recibe",
        "Teléfono",
        "Entrega",
        "Ciudad",
        "Productos",
        "Subtotal",
        "Envío",
        "Saldo a favor usado",
        "Total",
      ],
      rows,
    ),
  };
}

export async function customersCsv(search: string) {
  const customers = await getCustomers(search, MAX_EXPORT_ROWS);
  const rows: CsvValue[][] = customers.map((c) => [
    c.full_name,
    c.email,
    c.phone,
    formatDateTime(c.created_at),
    c.marketing_opt_in,
    c.appointments_count,
    c.completed_count,
    c.no_show_count,
    c.orders_count,
    c.credit_cop,
  ]);
  return {
    rows: rows.length,
    csv: toCsv(
      [
        "Nombre",
        "Correo",
        "Teléfono",
        "Cliente desde",
        "Acepta novedades",
        "Citas",
        "Asistió",
        "No asistió",
        "Pedidos",
        "Saldo a favor",
      ],
      rows,
    ),
  };
}

export async function reportCsv(from: string, to: string) {
  const report = await getReport(from, to);
  const rate = attendanceRate(report.appointments_by_status);
  const rows: CsvValue[][] = [
    ["Rango", `${from} a ${to}`],
    ["Ingresos en línea (total)", totalIncome(report)],
    ["Anticipos de citas", report.income.appointment_deposits_cop],
    ["Compras de la tienda", report.income.shop_cop],
    ["Anticipos de preventas", report.income.preorder_deposits_cop],
    ["Saldos de preventas", report.income.preorder_balances_cop],
    ...Object.entries(APPOINTMENT_STATUS_LABELS).map(([status, label]): CsvValue[] => [
      `Citas: ${label}`,
      report.appointments_by_status[status] ?? 0,
    ]),
    ["Asistencia (%)", rate],
    ["Saldo a favor vigente hoy", report.credit_outstanding_cop],
    ...report.top_products.map((p): CsvValue[] => [
      `Más vendido: ${p.name} (unidades)`,
      p.quantity,
    ]),
  ];
  return { rows: rows.length, csv: toCsv(["Dato", "Valor"], rows) };
}
