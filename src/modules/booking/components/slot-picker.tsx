import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Slot } from "../slots";

const QUICK_DAYS = 7;

/**
 * Selector de día y hora. Lo usan "agendar" y "reprogramar"; cada página dice
 * a dónde lleva cada día y cada horario. Funciona sin JavaScript.
 */
export function SlotPicker({
  today,
  last,
  date,
  slots,
  dayHref,
  slotHref,
  slotLabel = (time) => `Reservar a las ${time}`,
}: {
  today: string;
  last: string;
  date: string;
  slots: Slot[];
  dayHref: (day: string) => string;
  slotHref: (startsAt: Date) => string;
  slotLabel?: (time: string) => string;
}) {
  const quickDays = Array.from({ length: QUICK_DAYS }, (_, i) => addDays(today, i));

  return (
    <>
      <section aria-labelledby="titulo-dia" className="mt-6">
        <h2 id="titulo-dia" className="text-lg font-semibold">
          Día
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {quickDays.map((day) => (
            <li key={day}>
              <Link
                href={dayHref(day)}
                aria-current={day === date ? "date" : undefined}
                className={buttonVariants({
                  variant: day === date ? "default" : "outline",
                  size: "sm",
                })}
              >
                {/* Solo la primera letra en mayúscula: "Vie, 16 de oct". */}
                <span className="first-letter:uppercase">{formatShortDate(day)}</span>
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
                  href={slotHref(slot.startsAt)}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                  aria-label={slotLabel(slot.time)}
                >
                  {slot.time}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">Horas de Colombia.</p>
      </section>
    </>
  );
}
