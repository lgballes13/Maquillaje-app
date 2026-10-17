import { z } from "zod";
import { addDays, isDateString } from "@/lib/time";

/* Rango de fechas de los reportes y forma de los datos que devuelve admin_report. */

export const MAX_REPORT_DAYS = 366;

export interface ReportRange {
  from: string;
  to: string;
  error?: string;
}

/** Por defecto: del 1 del mes actual hasta hoy (hora del negocio). */
export function resolveReportRange(
  params: { desde?: string | string[]; hasta?: string | string[] },
  today: string,
): ReportRange {
  const defaults = { from: `${today.slice(0, 8)}01`, to: today };
  const from = typeof params.desde === "string" ? params.desde : undefined;
  const to = typeof params.hasta === "string" ? params.hasta : undefined;
  if (from === undefined && to === undefined) return defaults;
  if (!from || !to || !isDateString(from) || !isDateString(to)) {
    return { ...defaults, error: "Escribe las dos fechas del rango." };
  }
  if (to < from) return { ...defaults, error: "La fecha final no puede ser antes de la inicial." };
  if (addDays(from, MAX_REPORT_DAYS) < to) {
    return { ...defaults, error: "El rango puede ser de máximo un año." };
  }
  return { from, to };
}

const money = z.coerce.number().int();

export const reportSchema = z.object({
  income: z.object({
    appointment_deposits_cop: money,
    shop_cop: money,
    preorder_deposits_cop: money,
    preorder_balances_cop: money,
  }),
  appointments_by_status: z.record(z.string(), z.number().int()),
  top_products: z.array(
    z.object({ name: z.string(), quantity: z.number().int(), total_cop: money }),
  ),
  credit_outstanding_cop: money,
});

export type Report = z.infer<typeof reportSchema>;

export function totalIncome(report: Report): number {
  const i = report.income;
  return (
    i.appointment_deposits_cop + i.shop_cop + i.preorder_deposits_cop + i.preorder_balances_cop
  );
}

/** Asistencia sobre las citas que ya se marcaron (asistió + no asistió). */
export function attendanceRate(byStatus: Record<string, number>): number | null {
  const completed = byStatus.completed ?? 0;
  const marked = completed + (byStatus.no_show ?? 0);
  return marked === 0 ? null : Math.round((completed / marked) * 100);
}
