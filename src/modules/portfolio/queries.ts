import "server-only";
import { getSupabasePublicConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { pickCover, type PortfolioImageKind } from "./labels";

/** Lecturas del portafolio público. RLS solo deja ver los trabajos publicados. */

export const PORTFOLIO_BUCKET = "portafolio";
export const CONSENT_BUCKET = "autorizaciones";

export function portfolioImageUrl(storagePath: string): string {
  const { url } = getSupabasePublicConfig();
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${path}`;
}

type ImageRow = {
  kind: PortfolioImageKind;
  storage_path: string;
  alt_text: string;
  sort_order: number;
};

export interface PortfolioImage {
  url: string;
  alt: string;
  kind: PortfolioImageKind;
}

function toImage(row: ImageRow | null): PortfolioImage | null {
  return row
    ? { url: portfolioImageUrl(row.storage_path), alt: row.alt_text, kind: row.kind }
    : null;
}

export async function getPortfolioCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data;
}

export interface PortfolioCard {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  before: PortfolioImage | null;
  after: PortfolioImage | null;
}

export async function getPublishedWorks(
  categoryId: string | null,
  { limit = 100 }: { limit?: number } = {},
): Promise<PortfolioCard[]> {
  const supabase = await createClient();
  let query = supabase
    .from("portfolio_works")
    .select(
      "id, title, portfolio_categories(id, name, is_active), portfolio_images(kind, storage_path, alt_text, sort_order)",
    )
    .eq("is_published", true)
    .order("sort_order")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudo cargar el portafolio: ${error.message}`);
  return data.map((work) => {
    const cover = pickCover(work.portfolio_images);
    const category = work.portfolio_categories?.is_active ? work.portfolio_categories : null;
    return {
      id: work.id,
      title: work.title,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      before: toImage(cover.before),
      after: toImage(cover.after),
    };
  });
}

export async function getPublishedWork(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_works")
    .select(
      "id, title, description, portfolio_categories(id, name, is_active), services(id, name, is_active), portfolio_images(kind, storage_path, alt_text, sort_order)",
    )
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (!data) return null;
  const images = [...data.portfolio_images].sort((a, b) => a.sort_order - b.sort_order);
  const cover = pickCover(images);
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.portfolio_categories?.is_active
      ? { id: data.portfolio_categories.id, name: data.portfolio_categories.name }
      : null,
    // «Agendar este estilo» solo si el servicio sigue activo.
    service: data.services?.is_active ? { id: data.services.id, name: data.services.name } : null,
    before: toImage(cover.before),
    after: toImage(cover.after),
    others: images
      .filter((image) => image !== cover.before && image !== cover.after)
      .map((image) => toImage(image)!),
  };
}
