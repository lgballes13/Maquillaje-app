import { z } from "zod";

export const CUSTOMER_NOTE_MAX = 2000;
export const CUSTOMER_SEARCH_MAX = 100;

/** Texto de búsqueda de la lista de clientas (vacío = las más recientes). */
export function resolveCustomerSearch(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, CUSTOMER_SEARCH_MAX) : "";
}

export const customerNoteSchema = z.object({
  customerId: z.uuid("Clienta no válida."),
  note: z.string().trim().max(CUSTOMER_NOTE_MAX, `Máximo ${CUSTOMER_NOTE_MAX} caracteres.`),
});
