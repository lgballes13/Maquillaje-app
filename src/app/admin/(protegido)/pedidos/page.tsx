import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatCop } from "@/modules/booking/policy";
import { markOrderReviewedAction } from "@/modules/shop/admin-actions";
import { OrderStatusForm } from "@/modules/shop/components/order-status-form";
import {
  DELIVERY_LABELS,
  nextOrderActions,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/modules/shop/labels";

export const metadata: Metadata = { title: "Pedidos" };

const FILTERS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "por-preparar", label: "Por preparar", statuses: ["paid"] },
  { key: "por-entregar", label: "Por entregar", statuses: ["ready", "shipped"] },
  { key: "sin-pagar", label: "Sin pagar", statuses: ["pending_payment"] },
  { key: "cerrados", label: "Cerrados", statuses: ["delivered", "cancelled", "expired"] },
];

const chipClass =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.key === params.estado) ?? FILTERS[0]!;
  const supabase = await createClient();

  const [{ data: orders }, { data: toReview }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, number, status, delivery_method, recipient_name, phone, address, city, customer_notes, total_cop, created_at, paid_at, needs_review, review_note, order_items(id, product_name, quantity)",
      )
      .in("status", filter.statuses)
      .order("created_at", {
        ascending: filter.key === "por-preparar" || filter.key === "por-entregar",
      })
      .limit(100),
    supabase
      .from("orders")
      .select("id, number, status, review_note")
      .eq("needs_review", true)
      .order("created_at")
      .limit(50),
  ]);

  return (
    <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>

      {toReview?.length ? (
        <section
          aria-labelledby="titulo-revisar"
          className="mt-6 rounded-xl border border-amber-700/30 bg-amber-50 p-5 text-amber-900"
        >
          <h2 id="titulo-revisar" className="flex items-center gap-2 text-lg font-semibold">
            <TriangleAlert aria-hidden="true" className="size-5" />
            Por revisar
          </h2>
          <ul className="mt-3 grid gap-3 text-sm" aria-label="Pedidos por revisar">
            {toReview.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Pedido #{order.number}</strong> ({ORDER_STATUS_LABELS[order.status]}):{" "}
                  {order.review_note ?? "Revisar el pago."}
                </span>
                <form action={markOrderReviewedAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Ya lo revisé<span className="sr-only"> (pedido #{order.number})</span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label="Filtrar pedidos" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link
                href={`/admin/pedidos?estado=${f.key}`}
                aria-current={f.key === filter.key ? "page" : undefined}
                className={cn(
                  chipClass,
                  f.key === filter.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!orders?.length ? (
        <p className="mt-6 text-muted-foreground">No hay pedidos en «{filter.label}».</p>
      ) : (
        <ul className="mt-6 grid gap-3" aria-label={`Pedidos: ${filter.label}`}>
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  Pedido #{order.number} · {order.recipient_name}
                </h2>
                <span className="font-semibold">{formatCop(order.total_cop)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {ORDER_STATUS_LABELS[order.status]} · {DELIVERY_LABELS[order.delivery_method]} ·{" "}
                {formatDateTime(order.paid_at ?? order.created_at)}
              </p>
              <ul className="mt-2 text-sm">
                {order.order_items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.product_name}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm break-words">
                Celular: {order.phone}
                {order.delivery_method === "shipping" ? (
                  <>
                    <br />
                    Dirección: {order.address}, {order.city}
                  </>
                ) : null}
                {order.customer_notes ? (
                  <>
                    <br />
                    Notas: {order.customer_notes}
                  </>
                ) : null}
              </p>
              <OrderStatusForm orderId={order.id} targets={nextOrderActions(order)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
