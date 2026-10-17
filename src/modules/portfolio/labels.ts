import type { Database } from "@/lib/supabase/database.types";

export type PortfolioImageKind = Database["public"]["Enums"]["portfolio_image_kind"];

export const IMAGE_KIND_LABELS: Record<PortfolioImageKind, string> = {
  before: "Antes",
  after: "Después",
};

const PORTFOLIO_ERRORS: Record<string, string> = {
  consent_required:
    "Este trabajo no tiene una autorización vigente: no se puede publicar. Registra una autorización nueva.",
  after_photo_required: "Sube al menos una foto de «después» antes de publicar.",
  consent_revoked: "Esa autorización ya fue retirada.",
};

export function portfolioErrorMessage(code: string | undefined): string {
  return (code && PORTFOLIO_ERRORS[code]) ?? "No se pudo guardar. Intenta de nuevo.";
}

export const KNOWN_PORTFOLIO_ERRORS = new Set(Object.keys(PORTFOLIO_ERRORS));

/** Primera foto de cada tipo: la que se muestra en la tarjeta y en la comparación. */
export function pickCover<T extends { kind: PortfolioImageKind; sort_order: number }>(
  images: T[],
): { before: T | null; after: T | null } {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  return {
    before: sorted.find((image) => image.kind === "before") ?? null,
    after: sorted.find((image) => image.kind === "after") ?? null,
  };
}
