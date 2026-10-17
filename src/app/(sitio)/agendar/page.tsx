import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getActiveServices } from "@/modules/booking/queries";
import { formatCop, formatDuration } from "@/modules/booking/policy";

export const metadata: Metadata = {
  title: "Agendar cita",
  description: "Elige el servicio de maquillaje, el día y la hora de tu cita.",
};

export default async function BookingServicesPage() {
  const services = await getActiveServices();

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p className="text-sm font-medium text-muted-foreground">Paso 1 de 3</p>
      <h1 className="text-2xl font-bold tracking-tight">Elige tu servicio</h1>

      {services.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          En este momento no hay servicios disponibles para agendar.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-xs"
            >
              <h2 className="text-lg font-semibold">{service.name}</h2>
              {service.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
              ) : null}
              <p className="mt-3 flex items-center gap-2 text-sm">
                <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
                {formatDuration(service.duration_minutes)}
              </p>
              <p className="mt-1 text-lg font-semibold">{formatCop(service.price_cop)}</p>
              <Link
                href={`/agendar/${service.id}`}
                className={buttonVariants({ className: "mt-4 w-full" })}
                aria-label={`Elegir ${service.name}`}
              >
                Elegir
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
