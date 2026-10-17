import type { Database } from "@/lib/supabase/database.types";

/*
 * Textos de la tienda: estados, entrega, errores y la información de compra
 * que exige la Ley 1480 (precio total antes de pagar y derecho de retracto).
 */

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type DeliveryMethod = Database["public"]["Enums"]["delivery_method"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado: lo estamos preparando",
  ready: "Listo para recoger",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Vencido (no se pagó a tiempo)",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "border-amber-700/30 bg-amber-50 text-amber-900",
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
    default:
      return [];
  }
}

/** Si el tiempo para pagar ya pasó, el pedido se ve vencido aunque la base aún no lo marque. */
export function displayOrderStatus(
  order: { status: OrderStatus; hold_expires_at: string | null },
  now: Date = new Date(),
): OrderStatus {
  if (
    order.status === "pending_payment" &&
    order.hold_expires_at !== null &&
    new Date(order.hold_expires_at).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return order.status;
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
