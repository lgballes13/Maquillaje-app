import { z } from "zod";
import { detectImageType, type ImageType } from "@/modules/shop/schemas";

/*
 * Validaciones del portafolio. Los límites son los mismos de la base de datos.
 */

export const MAX_WORK_PHOTOS = 8;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

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

const nullableId = (message: string) =>
  z
    .uuid(message)
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((value) => value ?? null);

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const portfolioCategorySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(40, "Máximo 40 caracteres"),
  sort_order: integer("Orden", 0, 1000),
  is_active: checkbox,
});

/** Fecha de hoy (AAAA-MM-DD) en la zona del negocio. */
export function todayInBogota(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}

/** Datos de la autorización firmada (el archivo se revisa aparte). */
export const consentSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(3, "Escribe el nombre completo de la clienta")
    .max(100, "Máximo 100 caracteres"),
  signedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha en que firmó")
    .refine((value) => value <= todayInBogota(), "La fecha no puede ser futura"),
  notes: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((value) => value || null),
});

export const revokeConsentSchema = z.object({
  consentId: z.uuid("Autorización inválida"),
  reason: z
    .string()
    .trim()
    .min(3, "Cuenta brevemente por qué se retira")
    .max(300, "Máximo 300 caracteres"),
});

export const workSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(80, "Máximo 80 caracteres"),
  description: z
    .string()
    .trim()
    .max(1000, "Máximo 1.000 caracteres")
    .optional()
    .transform((value) => value || null),
  category_id: nullableId("Categoría inválida"),
  service_id: nullableId("Servicio inválido"),
  // Solo al crear: un trabajo no cambia de autorización.
  consent_id: optionalId,
  sort_order: integer("Orden", 0, 1000),
});

export type WorkInput = z.infer<typeof workSchema>;

export const publishSchema = z.object({
  workId: z.uuid(),
  publish: z.enum(["yes", "no"]),
});

export const workImageSchema = z.object({
  workId: z.uuid("Trabajo inválido"),
  kind: z.enum(["before", "after"], { message: "Elige si es la foto de antes o de después" }),
  altText: z
    .string()
    .trim()
    .min(3, "Describe la foto en pocas palabras (para lectores de pantalla)")
    .max(150, "Máximo 150 caracteres"),
});

export type DocumentType = ImageType | { contentType: "application/pdf"; ext: "pdf" };

/** Tipo real del formato firmado: foto (JPG, PNG, WebP) o PDF, según sus primeros bytes. */
export function detectDocumentType(bytes: Uint8Array): DocumentType | null {
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  if (pdf.every((value, i) => bytes[i] === value)) {
    return { contentType: "application/pdf", ext: "pdf" };
  }
  return detectImageType(bytes);
}
