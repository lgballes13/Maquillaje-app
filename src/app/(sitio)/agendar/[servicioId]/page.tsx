import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SlotPicker } from "@/modules/booking/components/slot-picker";
import { formatCop, formatDuration } from "@/modules/booking/policy";
import {
  bookingDateRange,
  getActiveService,
  getCurrentRules,
  getSlotsForDate,
  resolveBookingDate,
} from "@/modules/booking/queries";

export const metadata: Metadata = { title: "Elige día y hora" };

export default async function BookingDatePage({
  params,
  searchParams,
}: PageProps<"/agendar/[servicioId]">) {
  const { servicioId } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(servicioId).success) notFound();

  const service = await getActiveService(servicioId);
  if (!service) notFound();

  const rules = await getCurrentRules();
  const range = bookingDateRange(rules.max_booking_days_ahead);
  const date = resolveBookingDate(query.fecha, range);
  const slots = await getSlotsForDate(service, date);

  return (
    <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm font-medium text-muted-foreground">Paso 2 de 3</p>
      <h1 className="text-2xl font-bold tracking-tight">Elige día y hora</h1>
      <p className="mt-2 text-muted-foreground">
        {service.name} · {formatDuration(service.duration_minutes)} · {formatCop(service.price_cop)}{" "}
        <Link href="/agendar" className="font-medium text-primary underline underline-offset-4">
          Cambiar servicio
        </Link>
      </p>

      <SlotPicker
        today={range.today}
        last={range.last}
        date={date}
        slots={slots}
        dayHref={(day) => `/agendar/${service.id}?fecha=${day}`}
        slotHref={(startsAt) =>
          `/agendar/${service.id}/confirmar?inicio=${encodeURIComponent(startsAt.toISOString())}`
        }
      />
    </main>
  );
}
