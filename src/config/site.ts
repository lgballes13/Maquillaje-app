import { publicEnv } from "@/lib/env";

/**
 * Datos generales del sitio. Los valores reales del negocio llegan por
 * variables de entorno para no tener que tocar código cuando cambien.
 */
export const siteConfig = {
  name: publicEnv.NEXT_PUBLIC_BUSINESS_NAME,
  description:
    "Maquillaje profesional para novias, eventos sociales y asesorías. Agenda tu cita en línea y compra tus productos favoritos.",
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: "es_CO",
  whatsappNumber: publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER,
  whatsappMessage: "Hola, tengo una pregunta sobre sus servicios de maquillaje.",
} as const;
