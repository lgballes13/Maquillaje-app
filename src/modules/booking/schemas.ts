import { z } from "zod";
import { isDateString } from "@/lib/time";

export const dateParamSchema = z.string().refine(isDateString, "Fecha inválida");

/** Lo único que envía el navegador al reservar: servicio, hora y aceptación. */
export const bookingSchema = z.object({
  serviceId: z.uuid("Servicio inválido"),
  startsAt: z.iso.datetime({ offset: true, message: "Horario inválido" }),
  rulesVersion: z.coerce.number().int().positive(),
  acceptPolicy: z.literal("on", { message: "Debes aceptar la política de citas para continuar" }),
  notes: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((value) => value || undefined),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const appointmentIdSchema = z.object({ appointmentId: z.uuid("Cita inválida") });

/** Cambiar de horario: la cita, la hora nueva y la política vigente aceptada. */
export const rescheduleSchema = z.object({
  appointmentId: z.uuid("Cita inválida"),
  startsAt: z.iso.datetime({ offset: true, message: "Horario inválido" }),
  rulesVersion: z.coerce.number().int().positive(),
  acceptPolicy: z.literal("on", { message: "Debes aceptar la política de citas para continuar" }),
});
