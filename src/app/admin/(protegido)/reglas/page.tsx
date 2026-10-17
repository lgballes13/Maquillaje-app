import type { Metadata } from "next";
import { formatDateTime, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { HoursForm } from "@/modules/admin/components/hours-form";
import { RulesForm } from "@/modules/admin/components/rules-form";

export const metadata: Metadata = { title: "Reglas del negocio" };

export default async function BusinessRulesPage() {
  const supabase = await createClient();
  const [{ data: versions }, { data: hours }] = await Promise.all([
    supabase.from("business_rules").select("*").order("version", { ascending: false }).limit(10),
    supabase.from("business_hours").select("*").order("weekday"),
  ]);

  const current = versions?.[0];
  if (!current || !hours) throw new Error("No se encontraron las reglas del negocio");

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Reglas del negocio</h1>
      <p className="mt-2 text-muted-foreground">
        Versión vigente: <strong>{current.version}</strong> (desde{" "}
        {formatDateTime(current.created_at)}). Cada cambio crea una versión nueva; las citas
        guardarán la versión que aceptó la clienta.
      </p>

      <section
        aria-labelledby="titulo-reglas"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-reglas" className="mb-4 text-lg font-semibold">
          Anticipos y plazos
        </h2>
        <RulesForm
          current={{
            deposit_percent: Number(current.deposit_percent),
            reschedule_window_hours: current.reschedule_window_hours,
            reschedule_penalty_percent: Number(current.reschedule_penalty_percent),
            free_cancellation_hours: current.free_cancellation_hours,
            preorder_deposit_percent: Number(current.preorder_deposit_percent),
            preorder_delivery_days: current.preorder_delivery_days,
            buffer_minutes: current.buffer_minutes,
            booking_hold_minutes: current.booking_hold_minutes,
            min_booking_notice_hours: current.min_booking_notice_hours,
            max_booking_days_ahead: current.max_booking_days_ahead,
          }}
        />
      </section>

      <section
        aria-labelledby="titulo-horario"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-horario" className="mb-4 text-lg font-semibold">
          Horario de atención
        </h2>
        <HoursForm
          hours={hours.map((h) => ({
            weekday: h.weekday,
            is_open: h.is_open,
            opens_at: formatTime(h.opens_at),
            closes_at: formatTime(h.closes_at),
          }))}
        />
      </section>

      <section
        aria-labelledby="titulo-historial"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-historial" className="mb-4 text-lg font-semibold">
          Historial de versiones
        </h2>
        {/* tabIndex y role: en celular la tabla se desplaza de lado y debe poder usarse con teclado. */}
        <div
          className="overflow-x-auto focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          tabIndex={0}
          role="region"
          aria-label="Historial de versiones (se puede desplazar)"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Últimas 10 versiones de las reglas</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-4">
                  Versión
                </th>
                <th scope="col" className="py-2 pr-4">
                  Fecha
                </th>
                <th scope="col" className="py-2 pr-4">
                  Anticipo
                </th>
                <th scope="col" className="py-2">
                  Motivo
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium">{v.version}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(v.created_at)}</td>
                  <td className="py-2 pr-4">{Number(v.deposit_percent)} %</td>
                  <td className="py-2">{v.change_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
