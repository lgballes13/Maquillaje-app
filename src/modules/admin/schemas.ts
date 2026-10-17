import { z } from "zod";

const percent = (label: string) =>
  z.coerce
    .number({ message: `${label}: escribe un número` })
    .min(0, `${label}: mínimo 0 %`)
    .max(100, `${label}: máximo 100 %`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
      message: `${label}: máximo dos decimales`,
    });

const integer = (label: string, min: number, max: number) =>
  z.coerce
    .number({ message: `${label}: escribe un número` })
    .int(`${label}: escribe un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);

/**
 * Reglas del negocio. Los límites son los mismos de la base de datos (CHECK),
 * así el admin ve el error en el formulario antes de llegar a la base.
 */
export const businessRulesSchema = z.object({
  deposit_percent: percent("Anticipo"),
  reschedule_window_hours: integer("Plazo para reprogramar", 1, 720),
  reschedule_penalty_percent: percent("Penalidad por reprogramar"),
  free_cancellation_hours: integer("Cancelación sin penalidad", 0, 720),
  preorder_deposit_percent: percent("Anticipo de preventa"),
  preorder_delivery_days: integer("Días de entrega de preventa", 1, 365),
  buffer_minutes: integer("Preparación entre citas", 0, 240),
  booking_hold_minutes: integer("Tiempo para pagar", 5, 30),
  min_booking_notice_hours: integer("Anticipación mínima", 0, 720),
  max_booking_days_ahead: integer("Días hacia adelante", 1, 365),
  change_reason: z
    .string()
    .trim()
    .min(3, "Cuéntanos brevemente por qué cambias las reglas")
    .max(500, "Máximo 500 caracteres"),
});

export type BusinessRulesInput = z.infer<typeof businessRulesSchema>;
export const RULE_FIELDS = Object.keys(businessRulesSchema.shape).filter(
  (key) => key !== "change_reason",
) as Exclude<keyof BusinessRulesInput, "change_reason">[];

/** ¿Hay alguna diferencia real entre las reglas vigentes y las nuevas? */
export function rulesChanged(
  current: Record<(typeof RULE_FIELDS)[number], number | string>,
  next: BusinessRulesInput,
): boolean {
  return RULE_FIELDS.some((field) => Number(current[field]) !== Number(next[field]));
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

export const businessHourSchema = z
  .discriminatedUnion("is_open", [
    z.object({ weekday: z.number().int().min(0).max(6), is_open: z.literal(false) }),
    z.object({
      weekday: z.number().int().min(0).max(6),
      is_open: z.literal(true),
      opens_at: time,
      closes_at: time,
    }),
  ])
  .refine((day) => !day.is_open || day.opens_at < day.closes_at, {
    message: "La hora de cierre debe ser después de la de apertura",
    path: ["closes_at"],
  });

export type BusinessHourInput = z.infer<typeof businessHourSchema>;

/** Lee los 7 días del formulario de horario (campos open-0, opens-0, closes-0…). */
export function parseBusinessHoursForm(formData: FormData) {
  const days = Array.from({ length: 7 }, (_, weekday) => {
    const isOpen = formData.get(`open-${weekday}`) === "on";
    return isOpen
      ? {
          weekday,
          is_open: true as const,
          opens_at: String(formData.get(`opens-${weekday}`) ?? ""),
          closes_at: String(formData.get(`closes-${weekday}`) ?? ""),
        }
      : { weekday, is_open: false as const };
  });
  return z.array(businessHourSchema).length(7).safeParse(days);
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------
export const serviceSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(3, "Mínimo 3 caracteres").max(80, "Máximo 80 caracteres"),
  description: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((value) => value || null),
  duration_minutes: integer("Duración", 15, 600),
  price_cop: integer("Precio", 1000, 50_000_000),
  sort_order: integer("Orden", 0, 1000),
  is_active: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

// ---------------------------------------------------------------------------
// Bloqueos de agenda (las fechas y horas se escriben en la hora del negocio)
// ---------------------------------------------------------------------------
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const blockSchema = z.object({
  startDate: dateField,
  startTime: time,
  endDate: dateField,
  endTime: time,
  reason: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .transform((value) => value || null),
});

export type BlockInput = z.infer<typeof blockSchema>;
