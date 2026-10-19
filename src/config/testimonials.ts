/**
 * Testimonios del inicio. Para publicar uno real: cambia el texto por la reseña de la
 * clienta (con su permiso), pon su nombre como ella quiera aparecer y cambia
 * `sample` a `false`. Mientras `sample` sea `true`, la tarjeta muestra «Ejemplo».
 */
export interface Testimonial {
  quote: string;
  name: string;
  occasion: string;
  sample: boolean;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "Me sentí yo misma, pero en mi mejor versión. El maquillaje aguantó la ceremonia, las fotos y toda la fiesta.",
    name: "Clienta de ejemplo",
    occasion: "Maquillaje de novia",
    sample: true,
  },
  {
    quote:
      "Agendé en dos minutos y llegué sin estrés. Me explicaron cada paso y el resultado se veía natural en persona y en fotos.",
    name: "Clienta de ejemplo",
    occasion: "Maquillaje social",
    sample: true,
  },
  {
    quote:
      "Salí sabiendo qué productos usar con mi tipo de piel y cómo hacerme un look para el trabajo y otro para la noche.",
    name: "Clienta de ejemplo",
    occasion: "Asesoría personalizada",
    sample: true,
  },
];
