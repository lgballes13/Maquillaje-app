import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/modules/admin/components/service-form";
import { formatCop, formatDuration } from "@/modules/booking/policy";

export const metadata: Metadata = { title: "Servicios" };

export default async function AdminServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price_cop, sort_order, is_active")
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-4xl text-plum">Servicios</h1>
      <p className="mt-2 text-muted-foreground">
        Los servicios no se borran (las citas pasadas los usan): desmarca «Visible para agendar»
        para ocultarlos. Cambiar un precio no afecta las citas ya reservadas.
      </p>

      <section
        aria-labelledby="titulo-nuevo"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-nuevo" className="mb-4 text-lg font-semibold">
          Nuevo servicio
        </h2>
        <ServiceForm />
      </section>

      <section aria-labelledby="titulo-lista" className="mt-8">
        <h2 id="titulo-lista" className="text-lg font-semibold">
          Servicios existentes
        </h2>
        <ul className="mt-3 grid gap-3">
          {services?.map((service) => (
            <li key={service.id} className="rounded-xl border border-border bg-card">
              <details>
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 px-5 py-3">
                  <span className="font-semibold">{service.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(service.duration_minutes)} · {formatCop(service.price_cop)}
                    {service.is_active ? "" : " · Oculto"}
                  </span>
                </summary>
                <div className="border-t border-border p-5">
                  <ServiceForm service={service} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
