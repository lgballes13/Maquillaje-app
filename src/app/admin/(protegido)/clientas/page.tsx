import type { Metadata } from "next";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { resolveCustomerSearch } from "@/modules/admin/customers";
import { getCustomers } from "@/modules/admin/queries";
import { formatCop } from "@/modules/booking/policy";
import { requireAdmin } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Clientas" };

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/clientas">) {
  // El layout también lo revisa, pero corre en paralelo con la página.
  await requireAdmin("/admin/clientas");
  const search = resolveCustomerSearch((await searchParams).q);
  const customers = await getCustomers(search);
  const exportHref = search
    ? `/admin/exportar/clientas?q=${encodeURIComponent(search)}`
    : "/admin/exportar/clientas";

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-4xl text-plum">Clientas</h1>
      <p className="mt-2 text-muted-foreground">
        Busca por nombre, correo o teléfono. Sus datos son personales (Ley 1581): úsalos solo para
        atenderlas.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <form action="/admin/clientas" role="search" className="flex flex-wrap items-end gap-2">
          <div className="grid gap-2">
            <label htmlFor="buscar-clienta" className="text-sm font-medium">
              Buscar clienta
            </label>
            <input
              id="buscar-clienta"
              name="q"
              type="search"
              maxLength={100}
              defaultValue={search}
              className="min-h-11 w-64 max-w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Search aria-hidden="true" className="size-4" />
            Buscar
          </button>
        </form>
        <a
          href={exportHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
        >
          <Download aria-hidden="true" className="size-4" />
          Descargar {search ? "estos resultados" : "todas las clientas"} (CSV)
        </a>
      </div>

      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        {search
          ? `${customers.length} resultado${customers.length === 1 ? "" : "s"} para «${search}»`
          : "Las 50 clientas más recientes"}
      </p>

      {customers.length ? (
        <ul className="mt-3 grid gap-3" aria-label="Lista de clientas">
          {customers.map((customer) => (
            <li key={customer.id} className="rounded-xl border border-border bg-card p-4">
              <Link
                href={`/admin/clientas/${customer.id}`}
                className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
              >
                {customer.full_name || "Sin nombre"}
              </Link>
              <p className="text-sm break-words">
                {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.appointments_count} citas · {customer.no_show_count} inasistencias ·{" "}
                {customer.orders_count} pedidos
                {customer.credit_cop > 0
                  ? ` · Saldo a favor ${formatCop(customer.credit_cop)}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted-foreground" data-testid="no-customers">
          No encontramos clientas.
        </p>
      )}
    </main>
  );
}
