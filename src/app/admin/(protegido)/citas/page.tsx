import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { toZonedDateString } from "@/lib/time";
import { deleteBlockAction, markAttendanceAction } from "@/modules/admin/actions";
import { BlockForm } from "@/modules/admin/components/block-form";
import { APPOINTMENT_STATUS_LABELS, formatCop } from "@/modules/booking/policy";

export const metadata: Metadata = { title: "Citas" };

/*
 * Lista básica de citas próximas y bloqueos de agenda.
 * La agenda completa (calendario, filtros, cambios de estado) llega en la Fase 7.
 */
function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export default async function AdminAppointmentsPage() {
  const supabase = await createClient();
  const since = hoursAgoIso(24);
  const nowIso = hoursAgoIso(0);

  const [{ data: appointments }, { data: blocks }, { data: toMark }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, customer_id, service_name, starts_at, status, deposit_cop, needs_review, review_note",
      )
      .gte("starts_at", since)
      .in("status", ["pending_payment", "confirmed"])
      .order("starts_at")
      .limit(100),
    supabase
      .from("blocked_periods")
      .select("id, starts_at, ends_at, reason")
      .gte("ends_at", nowIso)
      .order("starts_at"),
    // Citas confirmadas que ya empezaron: falta decir si la clienta asistió.
    supabase
      .from("appointments")
      .select("id, customer_id, service_name, starts_at")
      .eq("status", "confirmed")
      .lte("starts_at", nowIso)
      .order("starts_at")
      .limit(50),
  ]);

  // Citas con algo por revisar (ej.: pago aprobado tarde), sin importar su estado.
  const { data: toReview } = await supabase
    .from("appointments")
    .select("id, service_name, starts_at, review_note")
    .eq("needs_review", true)
    .order("starts_at")
    .limit(50);

  const customerIds = [
    ...new Set([...(appointments ?? []), ...(toMark ?? [])].map((a) => a.customer_id)),
  ];
  const { data: profiles } = customerIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds)
    : { data: [] };
  const profileById = new Map(profiles?.map((p) => [p.id, p]));

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Citas</h1>

      {toReview?.length ? (
        <section
          aria-labelledby="titulo-revisar"
          className="mt-6 rounded-xl border border-amber-700/30 bg-amber-50 p-5 text-amber-950"
        >
          <h2 id="titulo-revisar" className="flex items-center gap-2 text-lg font-semibold">
            <TriangleAlert aria-hidden="true" className="size-5" />
            Por revisar
          </h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {toReview.map((a) => (
              <li key={a.id}>
                <strong>{a.service_name}</strong> · {formatDateTime(a.starts_at)}: {a.review_note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {toMark?.length ? (
        <section
          aria-labelledby="titulo-asistencia"
          className="mt-6 rounded-xl border border-border bg-card p-5"
        >
          <h2 id="titulo-asistencia" className="text-lg font-semibold">
            Por marcar asistencia
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Si marcas «No asistió», la clienta tiene un plazo para reprogramar según la política que
            aceptó.
          </p>
          <ul className="mt-4 grid gap-2" aria-label="Citas por marcar asistencia">
            {toMark.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <span>
                  <strong>{a.service_name}</strong> · {formatDateTime(a.starts_at)}
                  <span className="block text-muted-foreground">
                    {profileById.get(a.customer_id)?.full_name ?? "—"}
                  </span>
                </span>
                <form action={markAttendanceAction} className="flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <Button type="submit" name="attended" value="true" size="sm">
                    Asistió
                  </Button>
                  <Button type="submit" name="attended" value="false" variant="outline" size="sm">
                    No asistió
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="titulo-proximas"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-proximas" className="mb-4 text-lg font-semibold">
          Próximas citas
        </h2>
        {!appointments?.length ? (
          <p className="text-sm text-muted-foreground">No hay citas próximas.</p>
        ) : (
          <div
            className="overflow-x-auto focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Próximas citas (se puede desplazar)"
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Citas pendientes de pago y confirmadas</caption>
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4">
                    Fecha
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Servicio
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Clienta
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Anticipo
                  </th>
                  <th scope="col" className="py-2">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => {
                  const profile = profileById.get(a.customer_id);
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(a.starts_at)}</td>
                      <td className="py-2 pr-4">{a.service_name}</td>
                      <td className="py-2 pr-4">
                        {profile?.full_name ?? "—"}
                        {profile?.phone ? (
                          <span className="block text-muted-foreground">{profile.phone}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatCop(a.deposit_cop)}</td>
                      <td className="py-2">{APPOINTMENT_STATUS_LABELS[a.status]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="titulo-bloqueos"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-bloqueos" className="mb-4 text-lg font-semibold">
          Bloquear horarios
        </h2>
        <BlockForm today={toZonedDateString(new Date(), siteConfig.timeZone)} />

        {blocks?.length ? (
          <ul className="mt-6 grid gap-2" aria-label="Bloqueos vigentes">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <span>
                  {formatDateTime(b.starts_at)} → {formatDateTime(b.ends_at)}
                  {b.reason ? (
                    <span className="block text-muted-foreground">{b.reason}</span>
                  ) : null}
                </span>
                <form action={deleteBlockAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Quitar bloqueo
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
