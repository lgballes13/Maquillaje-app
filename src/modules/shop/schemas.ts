import { z } from "zod";

/*
 * Validaciones de la tienda. Los límites son los mismos de la base de datos
 * (CHECK y create_order): el formulario avisa antes de llegar a ella.
 */

export const MAX_UNITS_PER_PRODUCT = 10;
export const MAX_CART_LINES = 20;

export const cartItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_UNITS_PER_PRODUCT),
});

export const cartSchema = z
  .array(cartItemSchema)
  .max(MAX_CART_LINES)
  .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
    message: "Producto repetido",
  });

export type CartItem = z.infer<typeof cartItemSchema>;

const PHONE = /^\+?[0-9 ]{7,20}$/;

/** Datos de entrega y aceptación: los mismos para comprar y para reservar. */
const deliveryShape = {
  deliveryMethod: z.enum(["pickup", "shipping"], { message: "Elige cómo recibir tu pedido" }),
  recipientName: z
    .string()
    .trim()
    .min(3, "Escribe el nombre de quien recibe")
    .max(100, "Máximo 100 caracteres"),
  phone: z
    .string()
    .trim()
    .regex(PHONE, "Escribe un celular válido (solo números, ej.: 300 123 4567)"),
  address: z.string().trim().max(200, "Máximo 200 caracteres").optional().default(""),
  city: z.string().trim().max(80, "Máximo 80 caracteres").optional().default(""),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().default(""),
  rulesVersion: z.coerce.number().int().positive(),
  acceptTerms: z.literal("on", {
    message: "Debes aceptar las condiciones de compra para continuar",
  }),
};

function requireShippingAddress(
  data: { deliveryMethod: string; address: string; city: string },
  ctx: z.RefinementCtx,
) {
  if (data.deliveryMethod !== "shipping") return;
  if (data.address.length < 5) {
    ctx.addIssue({ code: "custom", path: ["address"], message: "Escribe la dirección de envío" });
  }
  if (data.city.length < 2) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "Escribe la ciudad" });
  }
}

/** Lo que envía el carrito al pagar: productos, entrega y aceptación. */
export const checkoutSchema = z
  .object({
    items: z
      .string()
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "Carrito inválido" });
          return z.NEVER;
        }
      })
      .pipe(cartSchema.min(1, "Tu carrito está vacío")),
    ...deliveryShape,
  })
  .superRefine(requireShippingAddress);

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Reserva (preventa) de un producto agotado: un solo producto por pedido. */
export const preorderSchema = z
  .object({
    productId: z.uuid("Producto inválido"),
    quantity: z.coerce
      .number({ message: "Elige cuántas unidades" })
      .int("Elige cuántas unidades")
      .min(1, "Mínimo 1 unidad")
      .max(MAX_UNITS_PER_PRODUCT, `Máximo ${MAX_UNITS_PER_PRODUCT} unidades`),
    ...deliveryShape,
  })
  .superRefine(requireShippingAddress);

export type PreorderInput = z.infer<typeof preorderSchema>;

export const productIdSchema = z.object({ productId: z.uuid("Producto inválido") });

export const orderIdSchema = z.object({ orderId: z.uuid("Pedido inválido") });

/** Búsqueda del catálogo: texto libre corto, sin comodines de SQL. */
export function cleanSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[%_*\\,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Panel: productos, categorías y fotos
// ---------------------------------------------------------------------------
const integer = (label: string, min: number, max: number) =>
  z.coerce
    .number({ message: `${label}: escribe un número` })
    .int(`${label}: escribe un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);

const optionalId = z
  .uuid()
  .optional()
  .or(z.literal("").transform(() => undefined));

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const productSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(3, "Mínimo 3 caracteres").max(80, "Máximo 80 caracteres"),
  description: z
    .string()
    .trim()
    .max(1000, "Máximo 1.000 caracteres")
    .optional()
    .transform((value) => value || null),
  category_id: z
    .uuid("Categoría inválida")
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((value) => value ?? null),
  price_cop: integer("Precio", 1000, 50_000_000),
  stock: integer("Unidades", 0, 100_000),
  sort_order: integer("Orden", 0, 1000),
  is_active: checkbox,
  allow_preorder: checkbox,
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(40, "Máximo 40 caracteres"),
  sort_order: integer("Orden", 0, 1000),
  is_active: checkbox,
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const imageMetaSchema = z.object({
  productId: z.uuid("Producto inválido"),
  altText: z
    .string()
    .trim()
    .min(3, "Describe la foto en pocas palabras (para lectores de pantalla)")
    .max(150, "Máximo 150 caracteres"),
});

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageType = { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: string };

/**
 * Tipo real de la imagen según sus primeros bytes (no según el nombre o lo
 * que diga el navegador, que se pueden falsificar). null si no es JPG, PNG o WebP.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const at = (offset: number, values: number[]) =>
    values.every((value, i) => bytes[offset + i] === value);
  if (at(0, [0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", ext: "jpg" };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", ext: "png" };
  }
  // RIFF....WEBP
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

export const ORDER_STATUS_TARGETS = ["ready", "shipped", "delivered", "cancelled"] as const;

/** Botones del panel: los estados de set_order_status y «llegó» (mark_preorder_arrived). */
export const orderStatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum([...ORDER_STATUS_TARGETS, "arrived"]),
});
