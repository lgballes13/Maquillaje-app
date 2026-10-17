"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";
import {
  notifyWaitlist,
  sendOrderConfirmationEmail,
  sendPreorderArrivedEmail,
} from "@/modules/notifications/service";
import { shopErrorMessage } from "./labels";
import { PRODUCT_BUCKET } from "./queries";
import {
  categorySchema,
  detectImageType,
  imageMetaSchema,
  MAX_IMAGE_BYTES,
  orderStatusSchema,
  productSchema,
} from "./schemas";

/*
 * Acciones del panel para la tienda. Igual que el resto del panel:
 * requireAdmin() revisa rol + 2FA y las reglas RLS lo vuelven a revisar.
 */

function revalidateShop(productId?: string) {
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
  if (productId) revalidatePath(`/tienda/${productId}`);
}

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin("/admin/productos");
  const values = safeFormValues(formData);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { id, ...category } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("product_categories").update(category).eq("id", id)
    : await supabase.from("product_categories").insert(category);
  if (error) {
    if (error.code === "23505") {
      return errorState("Ya existe una categoría con ese nombre.", undefined, values);
    }
    console.error("Error al guardar categoría", error.code, error.message);
    return errorState("No se pudo guardar la categoría. Intenta de nuevo.", undefined, values);
  }

  revalidateShop();
  return {
    status: "success",
    message: id
      ? `Categoría «${category.name}» actualizada.`
      : `Categoría «${category.name}» creada.`,
  };
}

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin("/admin/productos");
  const values = safeFormValues(formData);
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { id, ...product } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("products").update(product).eq("id", id)
    : await supabase.from("products").insert(product);
  if (error) {
    console.error("Error al guardar producto", error.code, error.message);
    return errorState("No se pudo guardar el producto. Intenta de nuevo.", undefined, values);
  }

  revalidateShop(id);
  // Si volvieron las unidades, avisa a la lista de espera (después de responder).
  if (id && product.is_active && product.stock > 0) after(() => notifyWaitlist(id));
  return {
    status: "success",
    message: id ? `Producto «${product.name}» actualizado.` : `Producto «${product.name}» creado.`,
  };
}

/**
 * Sube una foto al bucket público «productos». Se revisa el tipo real del
 * archivo (sus primeros bytes) y el tamaño; el nombre lo pone el servidor.
 */
export async function uploadProductImageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("/admin/productos");
  const values = safeFormValues(formData);
  const parsed = imageMetaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Elige una foto.", { image: ["Elige una foto"] }, values);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return errorState("La foto pesa más de 5 MB.", { image: ["Máximo 5 MB"] }, values);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return errorState(
      "Ese archivo no es una foto JPG, PNG o WebP.",
      { image: ["Usa una foto JPG, PNG o WebP"] },
      values,
    );
  }

  if (!(await consumeRateLimit("upload:user", admin.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const { productId, altText } = parsed.data;
  const supabase = await createClient();
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) >= 8) {
    return errorState("Cada producto puede tener máximo 8 fotos.", undefined, values);
  }

  const path = `${productId}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, bytes, { contentType: type.contentType, upsert: false });
  if (uploadError) {
    console.error("Error al subir foto", uploadError.message);
    return errorState("No se pudo subir la foto. Intenta de nuevo.", undefined, values);
  }

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: path,
    alt_text: altText,
    sort_order: count ?? 0,
  });
  if (error) {
    console.error("Error al guardar foto", error.code, error.message);
    await supabase.storage.from(PRODUCT_BUCKET).remove([path]);
    return errorState("No se pudo guardar la foto. Intenta de nuevo.", undefined, values);
  }

  revalidateShop(productId);
  return { status: "success", message: "Foto agregada." };
}

export async function deleteProductImageAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/productos");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { data: image, error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", id.data)
    .select("product_id, storage_path")
    .maybeSingle();
  if (error || !image) {
    if (error) console.error("Error al quitar foto", error.code, error.message);
    return;
  }
  const { error: storageError } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .remove([image.storage_path]);
  if (storageError) console.error("Error al borrar el archivo de la foto", storageError.message);
  revalidateShop(image.product_id);
}

/** Avanza un pedido (listo, enviado, entregado o cancelado). La base valida el paso. */
export async function setOrderStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin/pedidos");
  const parsed = orderStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Acción inválida.");

  const { orderId, status } = parsed.data;
  if (status === "arrived") return markPreorderArrived(orderId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) {
    if (error.message !== "invalid_transition") {
      console.error("Error al cambiar el pedido", error.code, error.message);
    }
    return errorState(shopErrorMessage(error.message));
  }
  revalidatePath("/admin/pedidos");
  return { status: "success", message: "Pedido actualizado." };
}

/**
 * Llegó el producto de una preventa: aparta las unidades y le pide a la
 * clienta pagar el saldo (o queda pagada si el anticipo cubría todo).
 */
async function markPreorderArrived(orderId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("mark_preorder_arrived", {
    p_order_id: orderId,
  });
  if (error) {
    if (error.message === "out_of_stock") return errorState(shopErrorMessage("not_arrived_stock"));
    if (error.message !== "invalid_transition") {
      console.error("Error al marcar la llegada", error.code, error.message);
    }
    return errorState(shopErrorMessage(error.message));
  }
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/productos");
  if (status === "awaiting_balance") {
    after(() => sendPreorderArrivedEmail(orderId));
    return { status: "success", message: "Listo: le avisamos a la clienta que pague el saldo." };
  }
  after(() => sendOrderConfirmationEmail(orderId));
  return { status: "success", message: "Listo: la preventa ya estaba pagada completa." };
}

/** Quita la marca «por revisar» de un pedido cuando la admin ya lo resolvió. */
export async function markOrderReviewedAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/pedidos");
  const id = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_reviewed", { p_order_id: id.data });
  if (error) console.error("Error al marcar revisado", error.code, error.message);
  revalidatePath("/admin/pedidos");
}
