"use server";

import { redirect } from "next/navigation";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { KNOWN_SHOP_ERRORS, shopErrorMessage } from "./labels";
import { quoteCart, type CartQuote } from "./queries";
import { cartSchema, checkoutSchema, orderIdSchema } from "./schemas";

/**
 * Precios y stock actuales del carrito. El carrito vive en el navegador, así
 * que la página lo envía aquí para mostrar los valores reales.
 */
export async function quoteCartAction(items: unknown): Promise<CartQuote | null> {
  const parsed = cartSchema.safeParse(items);
  if (!parsed.success) return null;
  try {
    return await quoteCart(parsed.data);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Crea el pedido y aparta las unidades. El navegador solo envía productos,
 * cantidades y datos de entrega: precios, envío y total los pone la base de
 * datos (create_order), que además revisa el stock bloqueando los productos.
 */
export async function createOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = safeFormValues(formData);
  const user = await requireUser("/carrito");
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  if (!(await consumeRateLimit("order:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const { items, deliveryMethod, recipientName, phone, address, city, notes, rulesVersion } =
    parsed.data;
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("create_order", {
    p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_delivery_method: deliveryMethod,
    p_recipient_name: recipientName,
    p_phone: phone,
    p_address: address,
    p_city: city,
    p_customer_notes: notes,
    p_rules_version: rulesVersion,
  });

  if (error || !orderId) {
    if (!error || !KNOWN_SHOP_ERRORS.has(error.message)) {
      console.error("Error al crear el pedido", error?.code, error?.message);
    }
    return errorState(shopErrorMessage(error?.message), undefined, values);
  }

  redirect(`/pedidos/${orderId}`);
}

/** La clienta cancela un pedido que todavía no pagó (suelta las unidades). */
export async function cancelOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = orderIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("No encontramos ese pedido.");
  const { orderId } = parsed.data;
  const user = await requireUser(`/pedidos/${orderId}`);

  if (!(await consumeRateLimit("order:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_order", { p_order_id: orderId });
  if (error) {
    if (!KNOWN_SHOP_ERRORS.has(error.message)) {
      console.error("Error al cancelar el pedido", error.code, error.message);
    }
    return errorState(shopErrorMessage(error.message));
  }
  redirect(`/pedidos/${orderId}`);
}
