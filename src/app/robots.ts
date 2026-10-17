import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** Lo privado (panel, cuenta, pagos) no se indexa; además esas páginas llevan noindex. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/cuenta",
        "/carrito",
        "/citas/",
        "/pedidos/",
        "/ingresar",
        "/registro",
        "/recuperar",
        "/restablecer",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
