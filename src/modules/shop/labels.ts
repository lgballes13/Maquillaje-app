import type { Database } from "@/lib/supabase/database.types";

/*
 * Textos de la tienda: estados, entrega, errores y la información de compra
 * que exige la Ley 1480 (precio total antes de pagar y derecho de retracto).
 */

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type DeliveryMethod = Database["public"]["Enums"]["delivery_method"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  deposit_paid: "Reservado: esperando que llegue",
  awaiting_balance: "Llegó: paga el saldo",
  paid: "Pagado: lo estamos preparando",
  ready: "Listo para recoger",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Vencido (no se pagó a tiempo)",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "border-amber-700/30 bg-amber-50 text-amber-900",
  deposit_paid: "border-sky-700/30 bg-sky-50 text-sky-900",
  awaiting_balance: "border-amber-700/30 bg-amber-50 text-amber-900",
  paid: "border-emerald-700/30 bg-emerald-50 text-emerald-900",
  ready: "border-emerald-700/30 bg-emerald-50 text-emerald-900",
  shipped: "border-emerald-700/30 bg-emerald-50 text-emerald-900",
  delivered: "border-emerald-700/30 bg-emerald-50 text-emerald-900",
  cancelled: "border-border bg-muted text-muted-foreground",
  expired: "border-border bg-muted text-muted-foreground",
};

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  pickup: "Recoger en el estudio",
  shipping: "Envío a domicilio",
};

/** Botones del panel para avanzar un pedido. */
export const ORDER_ACTION_LABELS = {
  arrived: "Marcar que llegó",
  ready: "Marcar listo para recoger",
  shipped: "Marcar enviado",
  delivered: "Marcar entregado",
  cancelled: "Cancelar pedido",
} as const;

/** Qué puede hacer la admin con un pedido en su estado actual (igual que set_order_status). */
export function nextOrderActions(order: {
  status: OrderStatus;
  delivery_method: DeliveryMethod;
}): (keyof typeof ORDER_ACTION_LABELS)[] {
  switch (order.status) {
    case "paid":
      return [order.delivery_method === "pickup" ? "ready" : "shipped", "cancelled"];
    case "ready":
    case "shipped":
      return ["delivered"];
    case "deposit_paid":
      return ["arrived", "cancelled"];
    case "awaiting_balance":
      return ["cancelled"];
    default:
      return [];
  }
}

/**
 * Si el tiempo para pagar ya pasó, el pedido se ve vencido aunque la base aún
 * no lo marque. Una preventa que no pagó el saldo a tiempo se ve cancelada.
 */
export function displayOrderStatus(
  order: { status: OrderStatus; hold_expires_at: string | null; balance_due_at?: string | null },
  now: Date = new Date(),
): OrderStatus {
  if (
    order.status === "pending_payment" &&
    order.hold_expires_at !== null &&
    new Date(order.hold_expires_at).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  if (isBalanceOverdue(order, now)) return "cancelled";
  return order.status;
}

/** ¿Se venció el plazo para pagar el saldo de una preventa que ya llegó? */
export function isBalanceOverdue(
  order: { status: OrderStatus; balance_due_at?: string | null },
  now: Date = new Date(),
): boolean {
  return (
    order.status === "awaiting_balance" &&
    Boolean(order.balance_due_at) &&
    new Date(order.balance_due_at as string).getTime() <= now.getTime()
  );
}

/** Anticipo de una preventa: el mismo redondeo de create_preorder (hacia arriba, al peso). */
export function preorderDeposit(subtotalCop: number, percent: number): number {
  return Math.ceil((subtotalCop * Math.round(percent * 100)) / 10000);
}

const SHOP_ERRORS: Record<string, string> = {
  not_authenticated: "Tu sesión terminó. Ingresa de nuevo para comprar.",
  policy_changed:
    "Las condiciones de la tienda cambiaron mientras comprabas (por ejemplo, la tarifa de envío). Revisa el total y vuelve a intentarlo.",
  invalid_items: "Tu carrito tiene algo inválido. Revísalo y vuelve a intentarlo.",
  invalid_delivery: "Escribe la dirección y la ciudad para el envío.",
  payment_in_progress:
    "Tienes un pago en proceso. Espera a que el banco lo confirme antes de hacer otro pedido.",
  product_unavailable: "Uno de los productos ya no está disponible. Quítalo del carrito.",
  out_of_stock:
    "No hay unidades suficientes de uno de los productos. Revisa las cantidades del carrito.",
  not_found: "No encontramos ese pedido.",
  already_paid: "Este pedido ya está pagado.",
  hold_expired:
    "Se acabó el tiempo para pagar y las unidades se liberaron. Haz el pedido de nuevo.",
  not_cancellable: "Este pedido ya no se puede cancelar.",
  invalid_transition: "El pedido cambió de estado. Recarga la página.",
  in_stock: "Este producto ya tiene unidades disponibles: puedes comprarlo directamente.",
  preorder_unavailable: "Este producto no se puede reservar en este momento.",
  not_arrived_stock:
    "Aún no hay unidades suficientes en el inventario. Actualiza las unidades del producto y vuelve a intentarlo.",
};

export function shopErrorMessage(code: string | undefined): string {
  return (
    (code && SHOP_ERRORS[code]) ?? "No pudimos completar tu pedido. Intenta de nuevo en un momento."
  );
}

export const KNOWN_SHOP_ERRORS = new Set(Object.keys(SHOP_ERRORS));

/**
 * Información de compra (Ley 1480 de 2011, Estatuto del Consumidor).
 * PENDIENTE de revisión legal: las excepciones del retracto (art. 47) para
 * productos de uso personal y la dirección de recogida (ver docs/estado.md).
 */
export function purchaseTerms(holdMinutes: number): string[] {
  return [
    "Los precios incluyen IVA. El total que ves arriba es lo que pagas: no hay cargos ocultos.",
    `Al continuar apartamos las unidades por ${holdMinutes} minutos mientras pagas; si no pagas a tiempo, se liberan.`,
    "Derecho de retracto: en compras en línea puedes retractarte dentro de los 5 días hábiles siguientes a la entrega. Escríbenos y te devolvemos el dinero cuando recibamos el producto. Por higiene, solo aplica a productos sin abrir y con su sello original.",
    "Si el producto llega con un defecto, tienes la garantía legal: te lo cambiamos o te devolvemos el dinero.",
  ];
}

/**
 * Información de la preventa antes de pagar el anticipo (Ley 1480).
 * PENDIENTE de revisión legal junto con purchaseTerms.
 */
export function preorderTerms(rules: {
  depositPercent: number;
  deliveryDays: number;
  balanceDays: number;
  creditValidityDays: number;
  holdMinutes: number;
}): string[] {
  return [
    `Pagas ahora un anticipo del ${rules.depositPercent} % del valor de los productos. El resto (y el envío, si lo elegiste) lo pagas cuando el producto llegue.`,
    `Tiempo estimado de llegada: ${rules.deliveryDays} días. Es un estimado del proveedor; te escribimos al correo apenas llegue.`,
    `Cuando te avisemos que llegó, tienes ${rules.balanceDays} días para pagar el saldo. Si no lo pagas a tiempo, liberamos las unidades y todo tu anticipo queda como saldo a favor (vence en ${rules.creditValidityDays} días y lo puedes usar en la tienda o en una cita).`,
    `Tienes ${rules.holdMinutes} minutos para pagar el anticipo; si no, la reserva se cancela sola.`,
    "Si quieres cancelar la reserva antes de que llegue, escríbenos y te ayudamos.",
    "Derecho de retracto: puedes retractarte dentro de los 5 días hábiles siguientes a la entrega. Por higiene, solo aplica a productos sin abrir y con su sello original.",
  ];
}
