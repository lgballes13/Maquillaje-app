import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { siteConfig } from "@/config/site";
import { formatClock, formatLongDate } from "@/lib/format";
import { toZonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";
import { resolveAgendaRange, type AgendaEntry, type AgendaView } from "@/modules/admin/agenda";
import { getAgenda } from "@/modules/admin/queries";
import { APPOINTMENT_STATUS_LABELS } from "@/modules/booking/policy";

export const metadata: Metadata = { title: "Agenda" };

const chipClass =
  "inline-flex min-h-11 items-center gap-1 rounded-full border px-4 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

const ENTRY_STYLES: Record<AgendaEntry["kind"], string> = {
  appointment: "border-primary/40 bg-primary/5",
  block: "border-amber-700/30 bg-amber-50 text-amber-950",
  free: "border-dashed border-border text-muted-foreground",
};

function agendaHref(view: AgendaView, date: string) {
  return `/admin/agenda?vista=${view}&fecha=${date}`;
}

export default async function AdminAgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  const today = toZonedDateString(new Date(), siteConfig.timeZone);
  const range = resolveAgendaRange(await searchParams, today);
  const { days, profiles } = await getAgenda(range.days);
  const first = range.days[0]!;
  const last = range.days.at(-1)!;
  const appointmentsCount = days.reduce(
    (sum, d) => sum + d.entries.filter((e) => e.kind === "appointment").length,
    0,
  );
  const unit = range.view === "dia" ? "día" : "semana";

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        {range.view === "dia"
          ? formatLongDate(first)
          : `Semana del ${formatLongDate(first)} al ${formatLongDate(last)}`}
        {" · "}
        {appointmentsCount === 1 ? "1 cita" : `${appointmentsCount} citas`}
      </p>

      <nav aria-label="Cambiar la vista de la agenda" className="mt-6 flex flex-wrap gap-2">
        {(["dia", "semana"] as const).map((view) => (
          <Link
            key={view}
            href={agendaHref(view, range.date)}
            aria-current={range.view === view ? "page" : undefined}
            className={cn(
              chipClass,
              range.view === view
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent",
            )}
          >
            {view === "dia" ? "Día" : "Semana"}
          </Link>
        ))}
        <span className="mx-1 hidden w-px bg-border sm:block" aria-hidden="true" />
        <Link
          href={agendaHref(range.view, range.previous)}
          className={cn(chipClass, "border-border bg-card hover:bg-accent")}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {range.view === "dia" ? "Día anterior" : "Semana anterior"}
        </Link>
        <Link
          href={agendaHref(range.view, today)}
          className={cn(chipClass, "border-border bg-card hover:bg-accent")}
        >
          Hoy
        </Link>
        <Link
          href={agendaHref(range.view, range.next)}
          className={cn(chipClass, "border-border bg-card hover:bg-accent")}
        >
          {range.view === "dia" ? "Día siguiente" : "Semana siguiente"}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </nav>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <form action="/admin/agenda" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="vista" value={range.view} />
          <div className="grid gap-2">
            <label htmlFor="fecha-agenda" className="text-sm font-medium">
              Ir a la fecha
            </label>
            <input
              id="fecha-agenda"
              name="fecha"
              type="date"
              defaultValue={range.date}
              className="min-h-11 rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <button
            type="submit"
            className="min-h-11 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Ver
          </button>
        </form>
        <a
          href={`/admin/exportar/citas?desde=${first}&hasta=${last}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
        >
          <Download aria-hidden="true" className="size-4" />
          Descargar las citas de este {unit} (CSV)
        </a>
      </div>

      <div className={cn("mt-6 grid gap-4", range.view === "semana" && "lg:grid-cols-2")}>
        {days.map((day) => (
          <section
            key={day.date}
            aria-labelledby={`dia-${day.date}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h2 id={`dia-${day.date}`} className="font-semibold capitalize">
              {formatLongDate(day.date)}
              {day.date === today ? (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground normal-case">
                  Hoy
                </span>
              ) : null}
            </h2>
            {day.entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {day.isOpen ? "Sin citas." : "Cerrado."}
              </p>
            ) : (
              <ul className="mt-3 grid gap-2" aria-label={`Agenda del ${formatLongDate(day.date)}`}>
                {day.entries.map((entry) => (
                  <li
                    key={`${entry.kind}-${entry.start.toISOString()}`}
                    className={cn("rounded-md border p-3 text-sm", ENTRY_STYLES[entry.kind])}
                  >
                    <span className="font-medium whitespace-nowrap">
                      {formatClock(entry.start)} – {formatClock(entry.end)}
                    </span>
                    {entry.kind === "appointment" ? (
                      <span className="block">
                        <strong>{entry.appointment.serviceName}</strong> ·{" "}
                        {APPOINTMENT_STATUS_LABELS[
                          entry.appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
                        ] ?? entry.appointment.status}
                        <span className="block">
                          <Link
                            href={`/admin/clientas/${entry.appointment.customerId}`}
                            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
                          >
                            {profiles.get(entry.appointment.customerId)?.full_name || "Clienta"}
                          </Link>
                          {profiles.get(entry.appointment.customerId)?.phone ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {profiles.get(entry.appointment.customerId)?.phone}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    ) : entry.kind === "block" ? (
                      <span className="block">
                        <strong>Bloqueado</strong>
                        {entry.block.reason ? ` · ${entry.block.reason}` : ""}
                      </span>
                    ) : (
                      <span className="block">Libre</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Para bloquear horarios o marcar asistencia ve a{" "}
        <Link href="/admin/citas" className="font-medium text-primary underline underline-offset-4">
          Citas
        </Link>
        .
      </p>
    </main>
  );
}
