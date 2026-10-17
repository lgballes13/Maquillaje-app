import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { formatFullDateTime } from "@/lib/format";
import { toZonedDateString } from "@/lib/time";
import { requireUser } from "@/modules/auth/session";
import { RescheduleConfirmForm } from "@/modules/booking/components/reschedule-confirm-form";
import {
  amountDueToday,
  availableAction,
  depositFor,
  formatCop,
  formatDuration,
  policyPoints,
} from "@/modules/booking/policy";
import {
  getActiveService,
  getAppointmentWithPolicy,
  getCurrentRules,
  getMyCreditBalance,
  getSlotsForDate,
} from "@/modules/booking/queries";

export const metadata: Metadata = { title: "Confirma el cambio", robots: { index: false } };

export default async function RescheduleConfirmPage({
  params,
  searchParams,
}: PageProps<"/citas/[id]/reprogramar/confirmar">) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const inicio = z.iso.datetime({ offset: true }).safeParse(query.inicio);
  if (!inicio.success) notFound();
  await requireUser(`/citas/${id}/reprogramar/confirmar?inicio=${encodeURIComponent(inicio.data)}`);

  const loaded = await getAppointmentWithPolicy(id);
  if (!loaded) notFound();
  const { appointment, rules: accepted, rescheduled } = loaded;
  const action = availableAction({ ...appointment, rescheduled }, accepted);
  const service = await getActiveService(appointment.service_id);
  if (!service || (action.kind !== "change" && action.kind !== "reschedule_after_no_show")) {
    return (
      <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Confirma el cambio</h1>
        <p className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
          Esta cita ya no se puede reprogramar.{" "}
          <Link
            href={`/citas/${id}`}
            className="font-medium text-primary underline underline-offset-4"
          >
            Volver a mi cita
          </Link>
        </p>
      </main>
    );
  }

  const [rules, balance] = await Promise.all([getCurrentRules(), getMyCreditBalance()]);
  const startsAt = new Date(inicio.data);
  const slots = await getSlotsForDate(service, toZonedDateString(startsAt, siteConfig.timeZone));
  const stillFree = slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime());

  // Lo que la cita actual deja como saldo, más el saldo que la clienta ya tenía.
  const carried = action.kind === "change" ? appointment.deposit_cop : action.credit;
  const deposit = depositFor(service.price_cop, rules.deposit_percent);
  const { creditApplied, due } = amountDueToday(deposit, balance + carried);

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Confirma el cambio</h1>

      <section
        aria-labelledby="titulo-resumen"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-resumen" className="text-lg font-semibold">
          Resumen
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Servicio</dt>
            <dd className="font-medium">
              {service.name} ({formatDuration(service.duration_minutes)})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Horario actual</dt>
            <dd className="font-medium first-letter:uppercase">
              {formatFullDateTime(appointment.starts_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Horario nuevo</dt>
            <dd className="font-medium first-letter:uppercase">{formatFullDateTime(startsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Anticipo de la nueva cita</dt>
            <dd className="font-medium">{formatCop(deposit)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saldo a favor que se aplica</dt>
            <dd className="font-medium" data-testid="credit-applied">
              {formatCop(creditApplied)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">A pagar hoy</dt>
            <dd className="text-lg font-semibold" data-testid="amount-due">
              {formatCop(due)}
            </dd>
          </div>
        </dl>
      </section>

      {stillFree ? (
        <>
          <section
            aria-labelledby="titulo-politica"
            className="mt-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 id="titulo-politica" className="text-lg font-semibold">
              Política de citas
            </h2>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm">
              {policyPoints(rules).map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Versión {rules.version} de la política.
            </p>
          </section>
          <section aria-label="Confirmar cambio de horario" className="mt-6">
            <RescheduleConfirmForm
              appointmentId={id}
              startsAt={startsAt.toISOString()}
              rulesVersion={rules.version}
              requiresPayment={due > 0}
            />
          </section>
        </>
      ) : (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p>Este horario ya no está disponible.</p>
          <Link
            href={`/citas/${id}/reprogramar`}
            className="mt-2 inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            Elegir otro horario
          </Link>
        </div>
      )}
    </main>
  );
}
