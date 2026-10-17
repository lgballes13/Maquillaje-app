import { publicEnv } from "@/lib/env";

/**
 * En local, Supabase sirve las fotos por http://127.0.0.1, y el optimizador de
 * imágenes de Next.js no descarga de IP locales (protección contra SSRF).
 * Ahí se muestran sin optimizar; en producción (https) sí se optimizan.
 */
export const UNOPTIMIZED_IMAGES = Boolean(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://"),
);
