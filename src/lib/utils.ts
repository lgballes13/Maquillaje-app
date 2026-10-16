import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos (ej.: "p-2" + "p-4" → "p-4"). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Construye el enlace de WhatsApp con un mensaje inicial opcional. */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const url = new URL(`https://wa.me/${phone}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}
