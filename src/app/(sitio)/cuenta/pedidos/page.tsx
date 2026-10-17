import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/modules/auth/session";
import { formatCop } from "@/modules/booking/policy";
import { DELIVERY_LABELS, displayOrderStatus, ORDER_STATUS_LABELS } from "@/modules/shop/labels";
import { getMyOrders } from "@/modules/shop/queries";

export const metadata: Metadata = { title: "Mis pedidos", robots: { index: false } };

export default async function MyOrdersPage() {
  const user = await requireUser("/cuenta/pedidos");
  const orders = await getMyOrders(user.id);

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>

      {!orders.length ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-muted-foreground">Todavía no tienes pedidos.</p>
          <Link href="/tienda" className={buttonVariants({ className: "mt-4" })}>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3" aria-label="Pedidos">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/pedidos/${order.id}`}
                className="block min-h-11 rounded-xl border border-border bg-card p-4 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex justify-between gap-2 font-semibold">
                  <span>
                    {order.kind === "preorder" ? "Preventa" : "Pedido"} #{order.number}
                  </span>
                  <span>{formatCop(order.total_cop)}</span>
                </span>
                <span className="block text-sm">
                  {formatDateTime(order.created_at)} · {DELIVERY_LABELS[order.delivery_method]}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {ORDER_STATUS_LABELS[displayOrderStatus(order)]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
