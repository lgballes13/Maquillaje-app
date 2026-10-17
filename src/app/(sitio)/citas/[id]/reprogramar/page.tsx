import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatFullDateTime } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { SlotPicker } from "@/modules/booking/components/slot-picker";
import { availableAction, formatCop, formatDuration } from "@/modules/booking/policy";
import {
  bookingDateRange,
  getActiveService,
  getAppointmentWithPolicy,
  getCurrentRules,
  getSlotsForDate,
  resolveBookingDate,
} from "@/modules/booking/queries";

export const metadata: Metadata = { title: "Cambiar horario", robots: { index: false } };

export default async function ReschedulePage({
  params,
  searchParams,
}: PageProps<"/citas/[id]/reprogramar">) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireUser(`/citas/${id}/reprogramar`);

  const loaded = await getAppointmentWithPolicy(id);
  if (!loaded) notFound();
  const { appointment, rules: accepted, rescheduled } = loaded;
  const action = availableAction({ ...appointment, rescheduled }, accepted);
  const service = await getActiveService(appointment.service_id);

  const canReschedule =
    service !== null && (action.kind === "change" || action.kind === "reschedule_after_no_show");

  if (!canReschedule) {
    return (
      <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Cambiar horario</h1>
        <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
          <p>
            {action.kind === "cancel_only"
              ? `Faltan menos de ${accepted.free_cancellation_hours} horas para tu cita, así que ya no se puede cambiar el horario.`
              : service === null
                ? "Este servicio ya no está disponible. Escríbenos por WhatsApp y te ayudamos."
                : "Esta cita ya no se puede reprogramar."}
          </p>
          <Link
            href={`/citas/${id}`}
            className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
          >
            Volver a mi cita
          </Link>
        </div>
      </main>
    );
  }

  const rules = await getCurrentRules();
  const range = bookingDateRange(rules.max_booking_days_ahead);
  const date = resolveBookingDate(query.fecha, range);
  const slots = await getSlotsForDate(service, date);

  return (
    <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Cambiar horario</h1>
      <p className="mt-2 text-muted-foreground">
        {service.name} · {formatDuration(service.duration_minutes)} · Cita actual:{" "}
        <span className="inline-block first-letter:uppercase">
          {formatFullDateTime(appointment.starts_at)}
        </span>
      </p>
      <p
        className="mt-4 rounded-md border border-border bg-card p-3 text-sm"
        data-testid="reschedule-info"
      >
        {action.kind === "reschedule_after_no_show" ? (
          <>
            Tienes hasta el <strong>{formatFullDateTime(action.deadline)}</strong> para elegir un
            horario nuevo. Se descuenta el {Number(accepted.reschedule_penalty_percent)} % de tu
            anticipo y abonamos <strong>{formatCop(action.credit)}</strong> a la nueva cita.
          </>
        ) : (
          <>
            El cambio no tiene costo: tu anticipo de{" "}
            <strong>{formatCop(appointment.deposit_cop)}</strong> pasa a la nueva cita.
          </>
        )}
      </p>

      <SlotPicker
        today={range.today}
        last={range.last}
        date={date}
        slots={slots}
        dayHref={(day) => `/citas/${id}/reprogramar?fecha=${day}`}
        slotHref={(startsAt) =>
          `/citas/${id}/reprogramar/confirmar?inicio=${encodeURIComponent(startsAt.toISOString())}`
        }
        slotLabel={(time) => `Cambiar a las ${time}`}
      />
    </main>
  );
}
