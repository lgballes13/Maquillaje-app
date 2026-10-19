import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { CustomerNoteForm } from "@/modules/admin/components/customer-note-form";
import { getCustomer } from "@/modules/admin/queries";
import {
  APPOINTMENT_STATUS_LABELS,
  CREDIT_REASON_LABELS,
  formatCop,
} from "@/modules/booking/policy";
import { ORDER_STATUS_LABELS } from "@/modules/shop/labels";
import { requireAdmin } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Ficha de la clienta" };

export default async function AdminCustomerPage({
  params,
}: PageProps<"/admin/clientas/[clientaId]">) {
  const { clientaId } = await params;
  // El layout también lo revisa, pero corre en paralelo con la página.
  await requireAdmin(`/admin/clientas/${clientaId}`);
  if (!z.uuid().safeParse(clientaId).success) notFound();
  const data = await getCustomer(clientaId);
  if (!data) notFound();
  const { customer, appointments, orders, credit, note } = data;

  const stats = [
    { label: "Citas", value: String(customer.appointments_count) },
    { label: "Asistió", value: String(customer.completed_count) },
    { label: "No asistió", value: String(customer.no_show_count) },
    { label: "Pedidos", value: String(customer.orders_count) },
    { label: "Saldo a favor", value: formatCop(customer.credit_cop) },
  ];

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/admin/clientas"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        ← Volver a clientas
      </Link>
      <h1 className="mt-2 text-4xl text-plum">{customer.full_name || "Clienta sin nombre"}</h1>
      <p className="mt-2 break-words">
        <a
          href={`mailto:${customer.email}`}
          className="font-medium text-primary underline underline-offset-4"
        >
          {customer.email}
        </a>
        {customer.phone ? (
          <>
            {" · "}
            <a
              href={`tel:${customer.phone}`}
              className="font-medium text-primary underline underline-offset-4"
            >
              {customer.phone}
            </a>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Cliente desde {formatDateTime(customer.created_at)} ·{" "}
        {customer.marketing_opt_in ? "Acepta recibir novedades" : "No quiere recibir novedades"}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="customer-summary">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="titulo-nota"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-nota" className="mb-4 text-lg font-semibold">
          Nota interna
        </h2>
        <CustomerNoteForm customerId={customer.id} note={note?.note ?? ""} />
        {note ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Última edición: {formatDateTime(note.updated_at)}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="titulo-citas" className="mt-8">
        <h2 id="titulo-citas" className="text-lg font-semibold">
          Citas
        </h2>
        {appointments.length ? (
          <ul className="mt-3 grid gap-2" aria-label="Citas de la clienta">
            {appointments.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <strong>{a.service_name}</strong> · {formatDateTime(a.starts_at)}
                <span className="block text-muted-foreground">
                  {APPOINTMENT_STATUS_LABELS[a.status]} · Anticipo {formatCop(a.deposit_cop)} de{" "}
                  {formatCop(a.price_cop)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no tiene citas.</p>
        )}
      </section>

      <section aria-labelledby="titulo-pedidos" className="mt-8">
        <h2 id="titulo-pedidos" className="text-lg font-semibold">
          Pedidos
        </h2>
        {orders.length ? (
          <ul className="mt-3 grid gap-2" aria-label="Pedidos de la clienta">
            {orders.map((o) => (
              <li key={o.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <strong>
                  {o.kind === "preorder" ? "Preventa" : "Pedido"} #{o.number}
                </strong>{" "}
                · {formatDateTime(o.created_at)}
                <span className="block text-muted-foreground">
                  {ORDER_STATUS_LABELS[o.status]} · {formatCop(o.total_cop)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no tiene pedidos.</p>
        )}
      </section>

      <section aria-labelledby="titulo-saldo" className="mt-8">
        <h2 id="titulo-saldo" className="text-lg font-semibold">
          Movimientos de saldo a favor
        </h2>
        {credit.length ? (
          <ul className="mt-3 grid gap-2" aria-label="Movimientos de saldo">
            {credit.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm"
              >
                <span>
                  {CREDIT_REASON_LABELS[c.reason]} · {formatDateTime(c.created_at)}
                  {c.expires_at ? (
                    <span className="block text-muted-foreground">
                      Vence: {formatDateTime(c.expires_at)}
                    </span>
                  ) : null}
                </span>
                <strong className={c.amount_cop < 0 ? "text-muted-foreground" : undefined}>
                  {c.amount_cop > 0 ? "+" : "−"}
                  {formatCop(Math.abs(c.amount_cop))}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Sin movimientos.</p>
        )}
      </section>
    </main>
  );
}
