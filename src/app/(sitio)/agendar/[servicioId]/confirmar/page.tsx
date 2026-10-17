import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { formatFullDateTime } from "@/lib/format";
import { toZonedDateString } from "@/lib/time";
import { requireUser } from "@/modules/auth/session";
import { BookingConfirmForm } from "@/modules/booking/components/booking-confirm-form";
import {
  amountDueToday,
  depositFor,
  formatCop,
  formatDuration,
  policyPoints,
} from "@/modules/booking/policy";
import {
  getActiveService,
  getCurrentRules,
  getMyCreditBalance,
  getSlotsForDate,
} from "@/modules/booking/queries";

export const metadata: Metadata = { title: "Confirma tu cita", robots: { index: false } };

export default async function BookingConfirmPage({
  params,
  searchParams,
}: PageProps<"/agendar/[servicioId]/confirmar">) {
  const { servicioId } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(servicioId).success) notFound();

  const inicio = z.iso.datetime({ offset: true }).safeParse(query.inicio);
  if (!inicio.success) notFound();

  // Reservar exige sesión; después de ingresar vuelve a esta misma página.
  await requireUser(`/agendar/${servicioId}/confirmar?inicio=${encodeURIComponent(inicio.data)}`);

  const service = await getActiveService(servicioId);
  if (!service) notFound();
  const [rules, balance] = await Promise.all([getCurrentRules(), getMyCreditBalance()]);

  const startsAt = new Date(inicio.data);
  const slots = await getSlotsForDate(service, toZonedDateString(startsAt, siteConfig.timeZone));
  const stillFree = slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime());
  const deposit = depositFor(service.price_cop, rules.deposit_percent);
  // Informativo: la base de datos aplica el saldo a favor al reservar.
  const { creditApplied, due } = amountDueToday(deposit, balance);

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <p className="text-sm font-medium text-muted-foreground">Paso 3 de 3</p>
      <h1 className="text-2xl font-bold tracking-tight">Confirma tu cita</h1>

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
            <dt className="text-muted-foreground">Fecha y hora</dt>
            <dd className="font-medium first-letter:uppercase">{formatFullDateTime(startsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor del servicio</dt>
            <dd className="font-medium">{formatCop(service.price_cop)}</dd>
          </div>
          {creditApplied > 0 ? (
            <>
              <div>
                <dt className="text-muted-foreground">Anticipo</dt>
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
                <dd className="text-lg font-semibold" data-testid="deposit">
                  {formatCop(due)}
                </dd>
              </div>
            </>
          ) : (
            <div>
              <dt className="text-muted-foreground">Anticipo a pagar hoy</dt>
              <dd className="text-lg font-semibold" data-testid="deposit">
                {formatCop(deposit)}
              </dd>
            </div>
          )}
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

          <section aria-label="Confirmar reserva" className="mt-6">
            <BookingConfirmForm
              serviceId={service.id}
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
            href={`/agendar/${service.id}`}
            className="mt-2 inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            Elegir otro horario
          </Link>
        </div>
      )}
    </main>
  );
}
