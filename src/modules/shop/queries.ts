import "server-only";
import { getSupabasePublicConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { CartItem } from "./schemas";

/** Lecturas de la tienda. Todas pasan por las reglas RLS (solo productos activos). */

export const PRODUCT_BUCKET = "productos";

/** URL pública de una foto del bucket «productos». */
export function productImageUrl(storagePath: string): string {
  const { url } = getSupabasePublicConfig();
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/${PRODUCT_BUCKET}/${path}`;
}

type ImageRow = { storage_path: string; alt_text: string; sort_order: number };

export interface ProductImage {
  url: string;
  alt: string;
}

function sortedImages(images: ImageRow[] | null): ProductImage[] {
  return [...(images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order || a.storage_path.localeCompare(b.storage_path))
    .map((image) => ({ url: productImageUrl(image.storage_path), alt: image.alt_text }));
}

/** Unidades disponibles (stock menos lo apartado por pedidos sin pagar). */
export async function getAvailability(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_availability", {
    p_product_ids: productIds,
  });
  if (error) throw new Error(`No se pudo consultar el stock: ${error.message}`);
  return new Map(data.map((row) => [row.product_id, row.available]));
}

export async function getActiveCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data;
}

export interface CatalogProduct {
  id: string;
  name: string;
  priceCop: number;
  categoryName: string | null;
  image: ProductImage | null;
  available: number;
  /** Si está agotado, ¿se puede reservar? */
  allowPreorder: boolean;
}

/** Catálogo con búsqueda por nombre y filtro por categoría. */
export async function getCatalog(filters: {
  search: string;
  categoryId: string | null;
}): Promise<CatalogProduct[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "id, name, price_cop, allow_preorder, product_categories(name, is_active), product_images(storage_path, alt_text, sort_order)",
    )
    .eq("is_active", true)
    .order("sort_order")
    .order("name")
    .limit(100);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);

  const availability = await getAvailability(data.map((p) => p.id));
  return data.map((product) => ({
    id: product.id,
    name: product.name,
    priceCop: product.price_cop,
    categoryName: product.product_categories?.is_active ? product.product_categories.name : null,
    image: sortedImages(product.product_images)[0] ?? null,
    available: availability.get(product.id) ?? 0,
    allowPreorder: product.allow_preorder,
  }));
}

export async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, description, price_cop, allow_preorder, product_categories(id, name, is_active), product_images(storage_path, alt_text, sort_order)",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const availability = await getAvailability([id]);
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    priceCop: data.price_cop,
    category: data.product_categories?.is_active
      ? { id: data.product_categories.id, name: data.product_categories.name }
      : null,
    images: sortedImages(data.product_images),
    available: availability.get(id) ?? 0,
    allowPreorder: data.allow_preorder,
  };
}

/** Reglas vigentes de la tienda y de las preventas. */
export async function getShopRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_rules")
    .select(
      "version, shipping_fee_cop, booking_hold_minutes, preorder_deposit_percent, preorder_delivery_days, preorder_balance_days, credit_validity_days",
    )
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(`No se pudieron cargar las reglas: ${error.message}`);
  return data;
}

/** Saldo a favor vigente de la clienta (0 si no ha ingresado). */
export async function getMyCredit(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_credit_balance");
  if (error) return 0;
  return Math.max(data ?? 0, 0);
}

/** ¿La clienta está inscrita en la lista de espera de este producto (y aún no la avisamos)? */
export async function getWaitlistEntry(productId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_waitlist")
    .select("notified_at")
    .eq("product_id", productId)
    .eq("customer_id", userId)
    .maybeSingle();
  return data ? { notified: data.notified_at !== null } : null;
}

export interface QuoteLine {
  productId: string;
  name: string;
  image: ProductImage | null;
  unitPriceCop: number;
  quantity: number;
  available: number;
  lineTotalCop: number;
  problem: "unavailable" | "not_enough" | null;
}

export interface CartQuote {
  lines: QuoteLine[];
  /** Productos del carrito que ya no existen o no están activos. */
  missing: string[];
  subtotalCop: number;
  shippingFeeCop: number;
  holdMinutes: number;
  rulesVersion: number;
}

/**
 * Precios y stock ACTUALES de lo que hay en el carrito. Es lo que la clienta
 * ve antes de pagar; create_order vuelve a calcularlo todo al crear el pedido.
 */
export async function quoteCart(items: CartItem[]): Promise<CartQuote> {
  const supabase = await createClient();
  const ids = items.map((item) => item.productId);
  const [{ data: products, error }, { data: rules, error: rulesError }, availability] =
    await Promise.all([
      ids.length
        ? supabase
            .from("products")
            .select("id, name, price_cop, product_images(storage_path, alt_text, sort_order)")
            .in("id", ids)
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("business_rules")
        .select("version, shipping_fee_cop, booking_hold_minutes")
        .order("version", { ascending: false })
        .limit(1)
        .single(),
      getAvailability(ids),
    ]);
  if (error) throw new Error(`No se pudo cotizar el carrito: ${error.message}`);
  if (rulesError) throw new Error(`No se pudieron cargar las reglas: ${rulesError.message}`);

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: QuoteLine[] = [];
  const missing: string[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) {
      missing.push(item.productId);
      continue;
    }
    const available = availability.get(item.productId) ?? 0;
    lines.push({
      productId: product.id,
      name: product.name,
      image: sortedImages(product.product_images)[0] ?? null,
      unitPriceCop: product.price_cop,
      quantity: item.quantity,
      available,
      lineTotalCop: product.price_cop * item.quantity,
      problem: available === 0 ? "unavailable" : available < item.quantity ? "not_enough" : null,
    });
  }

  return {
    lines,
    missing,
    subtotalCop: lines.reduce((sum, line) => sum + line.lineTotalCop, 0),
    shippingFeeCop: rules.shipping_fee_cop,
    holdMinutes: rules.booking_hold_minutes,
    rulesVersion: rules.version,
  };
}

const ORDER_COLUMNS =
  "id, number, kind, status, rules_version, deposit_cop, credit_applied_cop, deposit_paid_at, arrived_at, balance_due_at, delivery_method, recipient_name, phone, address, city, customer_notes, subtotal_cop, shipping_cop, total_cop, hold_expires_at, paid_at, created_at, order_items(id, product_id, product_name, unit_price_cop, quantity, line_total_cop)";

/** Un pedido con sus productos (RLS: solo si es de la clienta o si es admin). */
export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  return data;
}

export async function getMyOrders(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, number, kind, status, delivery_method, total_cop, hold_expires_at, balance_due_at, created_at",
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`No se pudieron cargar tus pedidos: ${error.message}`);
  return data;
}
