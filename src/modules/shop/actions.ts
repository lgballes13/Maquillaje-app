"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import {
  sendOrderConfirmationEmail,
  sendPreorderDepositEmail,
} from "@/modules/notifications/service";
import { KNOWN_SHOP_ERRORS, shopErrorMessage } from "./labels";
import { quoteCart, type CartQuote } from "./queries";
import {
  cartSchema,
  checkoutSchema,
  orderIdSchema,
  preorderSchema,
  productIdSchema,
} from "./schemas";

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

  // Si el saldo a favor cubrió todo, el pedido ya quedó pagado: envía la confirmación.
  after(() => sendOrderConfirmationEmail(orderId));
  redirect(`/pedidos/${orderId}`);
}

/**
 * Reserva (preventa) de un producto agotado. Igual que create_order: el
 * anticipo, el envío y el total los calcula la base de datos (create_preorder).
 */
export async function createPreorderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeFormValues(formData);
  const productId = productIdSchema.safeParse(Object.fromEntries(formData));
  const user = await requireUser(
    productId.success ? `/tienda/${productId.data.productId}/reservar` : "/tienda",
  );
  const parsed = preorderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  if (!(await consumeRateLimit("order:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const data = parsed.data;
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("create_preorder", {
    p_product_id: data.productId,
    p_quantity: data.quantity,
    p_delivery_method: data.deliveryMethod,
    p_recipient_name: data.recipientName,
    p_phone: data.phone,
    p_address: data.address,
    p_city: data.city,
    p_customer_notes: data.notes,
    p_rules_version: data.rulesVersion,
  });

  if (error || !orderId) {
    if (!error || !KNOWN_SHOP_ERRORS.has(error.message)) {
      console.error("Error al crear la preventa", error?.code, error?.message);
    }
    return errorState(shopErrorMessage(error?.message), undefined, values);
  }

  // Si el saldo a favor cubrió el anticipo, la reserva ya quedó hecha.
  after(() => sendPreorderDepositEmail(orderId));
  redirect(`/pedidos/${orderId}`);
}

/**
 * Lista de espera sin pago: «Avísame cuando llegue» o «Ya no quiero el aviso».
 * Si ya la avisamos antes, inscribirse de nuevo vuelve a activar el aviso.
 */
export async function toggleWaitlistAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = productIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Producto inválido.");
  const { productId } = parsed.data;
  const user = await requireUser(`/tienda/${productId}`);
  const join = formData.get("intent") === "join";

  if (!(await consumeRateLimit("waitlist:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE);
  }

  const supabase = await createClient();
  // RLS: solo puede borrar e inscribir sus propias filas, y solo en productos activos.
  const { error: deleteError } = await supabase
    .from("product_waitlist")
    .delete()
    .eq("product_id", productId)
    .eq("customer_id", user.id);
  const { error } = join
    ? await supabase
        .from("product_waitlist")
        .insert({ product_id: productId, customer_id: user.id })
    : { error: deleteError };
  if (error) {
    console.error("Error en la lista de espera", error.code, error.message);
    return errorState("No pudimos guardar tu aviso. Intenta de nuevo.");
  }

  revalidatePath(`/tienda/${productId}`);
  return {
    status: "success",
    message: join
      ? "Listo: te escribimos al correo cuando vuelva."
      : "Listo: ya no te enviaremos el aviso.",
  };
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
