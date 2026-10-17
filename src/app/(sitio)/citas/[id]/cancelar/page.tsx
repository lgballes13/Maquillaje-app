import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatFullDateTime, formatLongDate } from "@/lib/format";
import { toZonedDateString } from "@/lib/time";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/modules/auth/session";
import { CancelAppointmentForm } from "@/modules/booking/components/cancel-form";
import {
  availableAction,
  cancellationPreview,
  creditExpiresAt,
  formatCop,
} from "@/modules/booking/policy";
import { getAppointmentWithPolicy } from "@/modules/booking/queries";

export const metadata: Metadata = { title: "Cancelar cita", robots: { index: false } };

export default async function CancelAppointmentPage({ params }: PageProps<"/citas/[id]/cancelar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireUser(`/citas/${id}/cancelar`);

  const loaded = await getAppointmentWithPolicy(id);
  if (!loaded) notFound();
  const { appointment, rules, rescheduled } = loaded;

  const action = availableAction({ ...appointment, rescheduled }, rules);
  const canCancel = action.kind === "change" || action.kind === "cancel_only";
  const preview = cancellationPreview(appointment, rules);
  const expiresOn = formatLongDate(toZonedDateString(creditExpiresAt(rules), siteConfig.timeZone));

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Cancelar cita</h1>
      <p className="mt-2 text-muted-foreground">
        {appointment.service_name} ·{" "}
        <span className="inline-block first-letter:uppercase">
          {formatFullDateTime(appointment.starts_at)}
        </span>
      </p>

      {canCancel ? (
        <>
          <section
            aria-labelledby="titulo-que-pasa"
            className="mt-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 id="titulo-que-pasa" className="text-lg font-semibold">
              Qué pasa con tu anticipo
            </h2>
            {preview.late ? (
              <p className="mt-2 text-sm" data-testid="cancel-preview">
                Faltan menos de {rules.free_cancellation_hours} horas para tu cita, así que se
                descuenta el {Number(rules.reschedule_penalty_percent)} % del anticipo (
                {formatCop(preview.penalty)}). Te quedan{" "}
                <strong>{formatCop(preview.credit)}</strong> como saldo a favor para tu próxima
                cita.
              </p>
            ) : (
              <p className="mt-2 text-sm" data-testid="cancel-preview">
                Cancelas con más de {rules.free_cancellation_hours} horas de anticipación: todo tu
                anticipo (<strong>{formatCop(preview.credit)}</strong>) queda como saldo a favor
                para tu próxima cita.
              </p>
            )}
            <p className="mt-2 text-sm" data-testid="credit-expiry">
              El saldo a favor vence en {rules.credit_validity_days} días (el {expiresOn}) y se usa
              en el anticipo de otra cita o en compras de la tienda.
            </p>
            {action.kind === "change" ? (
              <p className="mt-3 text-sm">
                ¿Solo necesitas otro día u hora?{" "}
                <Link
                  href={`/citas/${id}/reprogramar`}
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Cambia el horario sin costo
                </Link>
                .
              </p>
            ) : null}
          </section>
          <section aria-label="Confirmar cancelación" className="mt-6">
            <CancelAppointmentForm appointmentId={id} />
          </section>
        </>
      ) : (
        <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
          <p>Esta cita ya no se puede cancelar.</p>
          <Link
            href={`/citas/${id}`}
            className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
          >
            Volver a mi cita
          </Link>
        </div>
      )}
    </main>
  );
}
