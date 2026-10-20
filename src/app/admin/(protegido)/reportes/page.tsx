import type { Metadata } from "next";
import { Download } from "lucide-react";
import { siteConfig } from "@/config/site";
import { formatLongDate } from "@/lib/format";
import { toZonedDateString } from "@/lib/time";
import { getReport } from "@/modules/admin/queries";
import { attendanceRate, resolveReportRange, totalIncome } from "@/modules/admin/reports";
import { APPOINTMENT_STATUS_LABELS, formatCop } from "@/modules/booking/policy";
import { requireAdmin } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Reportes" };

const inputClass =
  "min-h-11 rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reportes">) {
  // El layout también lo revisa, pero corre en paralelo con la página.
  await requireAdmin("/admin/reportes");
  const today = toZonedDateString(new Date(), siteConfig.timeZone);
  const range = resolveReportRange(await searchParams, today);
  const report = await getReport(range.from, range.to);
  const rate = attendanceRate(report.appointments_by_status);
  const income = [
    { label: "Anticipos de citas", value: report.income.appointment_deposits_cop },
    { label: "Compras de la tienda", value: report.income.shop_cop },
    { label: "Anticipos de preventas", value: report.income.preorder_deposits_cop },
    { label: "Saldos de preventas", value: report.income.preorder_balances_cop },
  ];
  const statuses = Object.entries(APPOINTMENT_STATUS_LABELS)
    .map(([status, label]) => ({ label, total: report.appointments_by_status[status] ?? 0 }))
    .filter((s) => s.total > 0);

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-4xl text-plum">Reportes</h1>
      <p className="mt-2 text-muted-foreground">
        Del {formatLongDate(range.from)} al {formatLongDate(range.to)}. Solo cuenta lo que se pagó
        en línea (Wompi); el saldo de las citas que se paga en el estudio no aparece aquí.
      </p>

      <form
        action="/admin/reportes"
        className="mt-6 flex flex-wrap items-end gap-3"
        aria-label="Rango del reporte"
      >
        <div className="grid gap-2">
          <label htmlFor="reporte-desde" className="text-sm font-medium">
            Desde
          </label>
          <input
            id="reporte-desde"
            name="desde"
            type="date"
            required
            defaultValue={range.from}
            className={inputClass}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="reporte-hasta" className="text-sm font-medium">
            Hasta
          </label>
          <input
            id="reporte-hasta"
            name="hasta"
            type="date"
            required
            defaultValue={range.to}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Ver reporte
        </button>
        <a
          href={`/admin/exportar/reporte?desde=${range.from}&hasta=${range.to}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
        >
          <Download aria-hidden="true" className="size-4" />
          Descargar reporte (CSV)
        </a>
      </form>
      {range.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {range.error} Te mostramos el mes actual.
        </p>
      ) : null}
      <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
        <a
          href={`/admin/exportar/citas?desde=${range.from}&hasta=${range.to}`}
          className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
        >
          Descargar citas del rango (CSV)
        </a>
        <a
          href={`/admin/exportar/pedidos?desde=${range.from}&hasta=${range.to}`}
          className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
        >
          Descargar pedidos del rango (CSV)
        </a>
      </p>

      <section aria-labelledby="titulo-ingresos" className="mt-8">
        <h2 id="titulo-ingresos" className="text-lg font-semibold">
          Ingresos en línea
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 rounded-xl border border-primary/40 bg-primary/5 p-4 lg:col-span-1">
            <dt className="text-sm text-muted-foreground">Total</dt>
            <dd className="mt-1 text-xl font-bold" data-testid="report-total">
              {formatCop(totalIncome(report))}
            </dd>
          </div>
          {income.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-lg font-semibold">{formatCop(item.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="titulo-citas" className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 id="titulo-citas" className="text-lg font-semibold">
            Citas del rango
          </h2>
          {statuses.length ? (
            <ul className="mt-3 grid gap-1 text-sm">
              {statuses.map((s) => (
                <li key={s.label} className="flex justify-between gap-2">
                  <span>{s.label}</span>
                  <strong>{s.total}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No hay citas en este rango.</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Asistencia</h2>
          <p className="mt-3 text-3xl font-bold" data-testid="attendance-rate">
            {rate === null ? "—" : `${rate} %`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            De las citas ya marcadas como «Asistió» o «No asistió».
          </p>
          <h2 className="mt-5 text-lg font-semibold">Saldo a favor vigente</h2>
          <p className="mt-1 text-xl font-bold">{formatCop(report.credit_outstanding_cop)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lo que las clientas tienen hoy para usar (no depende del rango).
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-productos" className="mt-8">
        <h2 id="titulo-productos" className="text-lg font-semibold">
          Productos más vendidos
        </h2>
        {report.top_products.length ? (
          <div
            className="mt-3 overflow-x-auto focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Productos más vendidos (se puede desplazar)"
          >
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4">
                    Producto
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Unidades
                  </th>
                  <th scope="col" className="py-2">
                    Vendido
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.top_products.map((p) => (
                  <tr key={p.name} className="border-t border-border">
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 pr-4">{p.quantity}</td>
                    <td className="py-2 whitespace-nowrap">{formatCop(p.total_cop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No hubo ventas en este rango.</p>
        )}
      </section>
    </main>
  );
}
