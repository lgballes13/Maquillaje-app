import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Páginas públicas para los buscadores: las fijas, cada servicio, cada producto
 * activo y cada trabajo publicado del portafolio (RLS: solo lo público).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const supabase = await createClient();
  const [{ data: services }, { data: products }, { data: works }] = await Promise.all([
    supabase.from("services").select("id, updated_at").eq("is_active", true),
    supabase.from("products").select("id, updated_at").eq("is_active", true).limit(1000),
    supabase.from("portfolio_works").select("id, updated_at").eq("is_published", true).limit(1000),
  ]);

  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/agendar`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/tienda`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/portafolio`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const entry = (path: string, updatedAt: string, priority: number) => ({
    url: `${base}${path}`,
    lastModified: new Date(updatedAt),
    priority,
  });

  return [
    ...fixed,
    ...(services ?? []).map((s) => entry(`/agendar/${s.id}`, s.updated_at, 0.7)),
    ...(products ?? []).map((p) => entry(`/tienda/${p.id}`, p.updated_at, 0.6)),
    ...(works ?? []).map((w) => entry(`/portafolio/${w.id}`, w.updated_at, 0.5)),
  ];
}
