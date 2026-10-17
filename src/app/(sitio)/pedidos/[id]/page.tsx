import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatClock, formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { formatCop } from "@/modules/booking/policy";
import { applyWompiTransaction, getWompiConfig } from "@/modules/payments/service";
import {
  checkoutFields,
  fetchWompiTransaction,
  WOMPI_CHECKOUT_URL,
} from "@/modules/payments/wompi";
import { CancelOrderForm } from "@/modules/shop/components/cancel-order-form";
import { ClearCart } from "@/modules/shop/components/clear-cart";
import {
  DELIVERY_LABELS,
  displayOrderStatus,
  isBalanceOverdue,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  shopErrorMessage,
} from "@/modules/shop/labels";
import { getOrder } from "@/modules/shop/queries";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

/**
 * Wompi devuelve a la clienta con ?id=<transacción>. Si el webhook aún no ha
 * llegado, consultamos la transacción directo en Wompi y la aplicamos.
 */
async function reconcileFromRedirect(orderId: string, transactionId: string) {
  const config = getWompiConfig();
  if (!config) return;
  const transaction = await fetchWompiTransaction(config.mode, transactionId);
  if (!transaction) return;

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("order_payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("reference", transaction.reference)
    .maybeSingle();
  // Solo se aplica si la transacción corresponde a un pago de ESTE pedido.
  if (!payment) return;

  try {
    await applyWompiTransaction("api", transaction);
  } catch (error) {
    console.error(error);
  }
}

export default async function OrderPage({ params, searchParams }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/pedidos/${id}`);

  // RLS: solo devuelve el pedido si es de la clienta (o si es admin).
  let order = await getOrder(id);
  if (!order) notFound();

  const transactionId = typeof query.id === "string" ? query.id : undefined;
  if (
    transactionId &&
    (order.status === "pending_payment" || order.status === "awaiting_balance")
  ) {
    await reconcileFromRedirect(id, transactionId);
    order = (await getOrder(id)) ?? order;
  }

  // Preventa que no pagó el saldo a tiempo: la base la cierra y pasa el anticipo
  // a saldo a favor (lo hace también la tarea diaria; aquí se adelanta).
  if (isBalanceOverdue(order)) {
    const { error } = await createAdminClient().rpc("expire_orders");
    if (error) console.error("No se pudieron vencer los pedidos", error.message);
    order = (await getOrder(id)) ?? order;
  }

  const supabase = await createClient();
  const isPreorder = order.kind === "preorder";
  const [{ data: lastPayment }, { data: rules }, { data: forfeit }] = await Promise.all([
    supabase
      .from("order_payments")
      .select("status, provider_transaction_id")
      .eq("order_id", id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_rules")
      .select("preorder_delivery_days")
      .eq("version", order.rules_version)
      .maybeSingle(),
    isPreorder && order.status === "cancelled"
      ? supabase
          .from("credit_movements")
          .select("amount_cop")
          .eq("order_id", id)
          .eq("reason", "preorder_unpaid")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const status = displayOrderStatus(order);
  const payable = status === "pending_payment" || status === "awaiting_balance";
  const deposit = order.deposit_cop ?? 0;
  const wompi = getWompiConfig();
  let checkout: Record<string, string> | null = null;
  let amountCop = 0;
  let paymentError: string | null = null;
  const inProgress =
    lastPayment?.status === "pending" && Boolean(lastPayment.provider_transaction_id);
  if (payable && !inProgress) {
    if (!wompi) {
      paymentError = "Los pagos en línea todavía no están activos. Escríbenos por WhatsApp.";
    } else {
      const { data, error } = await supabase.rpc("prepare_order_payment", { p_order_id: id });
      const attempt = data?.[0];
      if (error || !attempt) {
        paymentError = shopErrorMessage(error?.message);
      } else {
        amountCop = Number(attempt.amount_in_cents) / 100;
        checkout = checkoutFields({
          publicKey: wompi.publicKey,
          integritySecret: wompi.integritySecret,
          reference: attempt.reference,
          amountInCents: attempt.amount_in_cents,
          expiresAt: new Date(attempt.expires_at),
          redirectUrl: `${siteConfig.url}/pedidos/${id}`,
          customerEmail: user.email,
        });
      }
    }
  }

  const declined =
    payable && (lastPayment?.status === "declined" || lastPayment?.status === "error");
  const justPaid = Boolean(transactionId) && order.paid_at !== null;

  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      {justPaid ? <ClearCart /> : null}
      <h1 className="text-2xl font-bold tracking-tight">Pedido #{order.number}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hecho el {formatDateTime(order.created_at)}
      </p>

      <p
        role="status"
        data-testid="order-status"
        className={cn(
          "mt-4 rounded-md border p-3 text-sm font-medium",
          ORDER_STATUS_STYLES[status],
        )}
      >
        {ORDER_STATUS_LABELS[status]}
      </p>

      <section
        aria-labelledby="titulo-productos"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-productos" className="text-lg font-semibold">
          Productos
        </h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span>
                {item.quantity} × {item.product_name}
                <span className="block text-xs text-muted-foreground">
                  {formatCop(item.unit_price_cop)} c/u
                </span>
              </span>
              <span className="font-medium">{formatCop(item.line_total_cop)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt>Productos</dt>
            <dd>{formatCop(order.subtotal_cop)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Envío</dt>
            <dd>{order.shipping_cop > 0 ? formatCop(order.shipping_cop) : "Sin costo"}</dd>
          </div>
          <div className="flex justify-between gap-2 text-base font-semibold">
            <dt>Total (IVA incluido)</dt>
            <dd data-testid="order-total">{formatCop(order.total_cop)}</dd>
          </div>
          {isPreorder ? (
            <>
              <div className="flex justify-between gap-2">
                <dt>Anticipo</dt>
                <dd data-testid="order-deposit">{formatCop(deposit)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Saldo cuando llegue</dt>
                <dd data-testid="order-balance">{formatCop(order.total_cop - deposit)}</dd>
              </div>
            </>
          ) : null}
          {order.credit_applied_cop > 0 ? (
            <div className="flex justify-between gap-2">
              <dt>Pagado con tu saldo a favor</dt>
              <dd data-testid="order-credit">{formatCop(order.credit_applied_cop)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {status === "deposit_paid" ? (
        <p
          className="mt-6 rounded-xl border border-border bg-card p-5 text-sm"
          data-testid="preorder-info"
        >
          Tu reserva está confirmada.
          {rules ? ` Tiempo estimado de llegada: ${rules.preorder_delivery_days} días.` : ""} Te
          escribimos al correo apenas llegue para que pagues el saldo de{" "}
          <strong>{formatCop(order.total_cop - deposit)}</strong>.
        </p>
      ) : null}
      {forfeit ? (
        <p
          className="mt-6 rounded-xl border border-border bg-card p-5 text-sm"
          data-testid="preorder-forfeit"
        >
          No recibimos el pago del saldo a tiempo, así que liberamos las unidades. Tu anticipo de{" "}
          <strong>{formatCop(forfeit.amount_cop)}</strong> quedó como saldo a favor: lo ves en{" "}
          <Link href="/cuenta" className="font-medium text-primary underline underline-offset-4">
            tu cuenta
          </Link>
          .
        </p>
      ) : null}

      <section
        aria-labelledby="titulo-entrega"
        className="mt-6 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-entrega" className="text-lg font-semibold">
          Entrega
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Forma de entrega</dt>
            <dd className="font-medium" data-testid="order-delivery">
              {DELIVERY_LABELS[order.delivery_method]}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Recibe</dt>
            <dd className="font-medium break-words">
              {order.recipient_name} · {order.phone}
            </dd>
          </div>
          {order.delivery_method === "shipping" ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Dirección</dt>
              <dd className="font-medium break-words">
                {order.address}, {order.city}
              </dd>
            </div>
          ) : null}
          {order.customer_notes ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notas</dt>
              <dd className="break-words">{order.customer_notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {payable ? (
        <section
          aria-labelledby="titulo-pago"
          className="mt-6 rounded-xl border border-border bg-card p-5"
        >
          <h2 id="titulo-pago" className="text-lg font-semibold">
            {status === "awaiting_balance"
              ? "Paga el saldo"
              : isPreorder
                ? "Paga el anticipo"
                : "Paga tu pedido"}
          </h2>
          {declined ? (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              Tu pago anterior no fue aprobado. Puedes intentarlo de nuevo.
            </p>
          ) : null}
          {inProgress ? (
            <p className="mt-2 text-sm">
              Tu pago está en proceso. Esta página se actualiza cuando el banco lo confirme; puedes
              recargarla en unos minutos.
            </p>
          ) : null}
          {status === "awaiting_balance" && order.balance_due_at ? (
            <p className="mt-2 text-sm" data-testid="balance-due">
              ¡Llegó tu producto! Tienes hasta el{" "}
              <strong>{formatDateTime(order.balance_due_at)}</strong> para pagar el saldo. Si no lo
              pagas a tiempo, liberamos las unidades y tu anticipo queda como saldo a favor.
            </p>
          ) : null}
          {status === "pending_payment" && order.hold_expires_at ? (
            <p className="mt-2 text-sm">
              {isPreorder ? "Tu reserva te espera" : "Tus productos están apartados"} hasta las{" "}
              <strong>{formatClock(order.hold_expires_at)}</strong>.{" "}
              {isPreorder
                ? "Si no pagas el anticipo a tiempo, la reserva se cancela."
                : "Si no pagas a tiempo, se liberan para otra persona."}
            </p>
          ) : null}

          {checkout ? (
            // Formulario hacia el checkout de Wompi. La firma impide cambiar el monto.
            <form
              method="get"
              action={WOMPI_CHECKOUT_URL}
              className="mt-4"
              data-testid="wompi-form"
            >
              {Object.entries(checkout).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Pagar {formatCop(amountCop)} con Wompi
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Tarjeta, PSE, Nequi y otros medios. Wompi procesa el pago; nosotros no vemos los
                datos de tu tarjeta.
              </p>
            </form>
          ) : paymentError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {paymentError}
            </p>
          ) : null}
          {status === "pending_payment" && !inProgress ? (
            <CancelOrderForm orderId={order.id} />
          ) : null}
        </section>
      ) : null}

      {(status === "expired" || status === "cancelled") && !isPreorder ? (
        <Link href="/carrito" className={buttonVariants({ className: "mt-6" })}>
          Volver al carrito
        </Link>
      ) : null}

      <p className="mt-6">
        <Link
          href="/cuenta/pedidos"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          Ver todos mis pedidos
        </Link>
      </p>
    </main>
  );
}
