import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { formatCop, formatDuration } from "@/modules/booking/policy";
import {
  bookingDateRange,
  getActiveService,
  getCurrentRules,
  getSlotsForDate,
} from "@/modules/booking/queries";
import { dateParamSchema } from "@/modules/booking/schemas";
import { z } from "zod";

export const metadata: Metadata = { title: "Elige día y hora" };

const QUICK_DAYS = 7;

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
  const { today, last } = bookingDateRange(rules.max_booking_days_ahead);
  const requested = dateParamSchema.safeParse(query.fecha);
  const date =
    requested.success && requested.data >= today && requested.data <= last ? requested.data : today;
  const slots = await getSlotsForDate(service, date);
  const quickDays = Array.from({ length: QUICK_DAYS }, (_, i) => addDays(today, i));

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

      <section aria-labelledby="titulo-dia" className="mt-6">
        <h2 id="titulo-dia" className="text-lg font-semibold">
          Día
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {quickDays.map((day) => (
            <li key={day}>
              <Link
                href={`/agendar/${service.id}?fecha=${day}`}
                aria-current={day === date ? "date" : undefined}
                className={cn(
                  buttonVariants({ variant: day === date ? "default" : "outline", size: "sm" }),
                  "capitalize",
                )}
              >
                {formatShortDate(day)}
              </Link>
            </li>
          ))}
        </ul>
        {/* Formulario GET: funciona sin JavaScript y el selector de fecha es el nativo del celular. */}
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="fecha">Otra fecha</Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              min={today}
              max={last}
              defaultValue={date}
              className="w-auto"
            />
          </div>
          <Button type="submit" variant="outline">
            Ver horarios
          </Button>
        </form>
      </section>

      <section aria-labelledby="titulo-horas" className="mt-8">
        <h2 id="titulo-horas" className="text-lg font-semibold first-letter:uppercase">
          Horarios del {formatLongDate(date)}
        </h2>
        {slots.length === 0 ? (
          <p className="mt-3 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            No hay horarios libres este día. Prueba con otra fecha.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slots.map((slot) => (
              <li key={slot.time}>
                <Link
                  href={`/agendar/${service.id}/confirmar?inicio=${encodeURIComponent(slot.startsAt.toISOString())}`}
                  className={buttonVariants({ variant: "outline", className: "w-full" })}
                  aria-label={`Reservar a las ${slot.time}`}
                >
                  {slot.time}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">Horas de Colombia.</p>
      </section>
    </main>
  );
}
