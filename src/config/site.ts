import { publicEnv } from "@/lib/env";

/**
 * Datos generales del sitio. Los valores reales del negocio llegan por
 * variables de entorno para no tener que tocar código cuando cambien.
 */
export const siteConfig = {
  name: publicEnv.NEXT_PUBLIC_BUSINESS_NAME,
  tagline: "Tu belleza, elevada",
  description:
    "Estudio boutique de maquillaje profesional para novias, eventos sociales y asesorías personalizadas. Agenda tu cita en línea, compra tus productos y mira nuestro portafolio.",
  keywords: [
    "maquillaje profesional",
    "maquillaje de novia",
    "maquillaje social",
    "asesoría de maquillaje",
    "estudio de maquillaje",
  ],
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: "es_CO",
  // Zona horaria del negocio (pendiente de confirmar). Todas las horas se muestran en ella.
  timeZone: "America/Bogota",
  whatsappNumber: publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER,
  // Datos del responsable (textos legales). Pendientes hasta que la dueña los defina.
  contactEmail: publicEnv.NEXT_PUBLIC_CONTACT_EMAIL,
  legalId: publicEnv.NEXT_PUBLIC_BUSINESS_LEGAL_ID,
  address: publicEnv.NEXT_PUBLIC_BUSINESS_ADDRESS,
  whatsappMessage: "Hola, tengo una pregunta sobre sus servicios de maquillaje.",
} as const;
