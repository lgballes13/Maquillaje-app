"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { sendConfirmationEmail } from "@/modules/notifications/service";
import { bookingErrorMessage } from "./policy";
import { appointmentIdSchema, bookingSchema, rescheduleSchema } from "./schemas";

/**
 * Aparta el horario elegido. El navegador solo envía el servicio, la hora y la
 * versión de la política que vio; el precio y el anticipo los pone la base de
 * datos (create_booking), que además revalida horario, anticipación y cruces.
 */
export async function createBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeFormValues(formData);
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  const serviceId = String(formData.get("serviceId") ?? "");
  const user = await requireUser(`/agendar/${encodeURIComponent(serviceId)}`);

  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  if (!(await consumeRateLimit("booking:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const supabase = await createClient();
  const { data: appointmentId, error } = await supabase.rpc("create_booking", {
    p_service_id: parsed.data.serviceId,
    p_starts_at: parsed.data.startsAt,
    p_rules_version: parsed.data.rulesVersion,
    p_customer_notes: parsed.data.notes,
  });

  if (error || !appointmentId) {
    logUnexpected("Error al reservar", error);
    return errorState(bookingErrorMessage(error?.message), undefined, values);
  }

  // Si el saldo a favor cubrió el anticipo, la cita ya quedó confirmada:
  // se envía el correo (si no, sendConfirmationEmail no hace nada).
  after(() => sendConfirmationEmail(appointmentId));
  redirect(`/citas/${appointmentId}`);
}

/**
 * Cancela una cita. La base de datos (cancel_appointment) decide cuánto queda
 * como saldo a favor según la política que la clienta aceptó al reservar.
 */
export async function cancelAppointmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = appointmentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("No encontramos esa cita.");
  const { appointmentId } = parsed.data;
  const user = await requireUser(`/citas/${appointmentId}/cancelar`);

  if (!(await consumeRateLimit("appointment:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", { p_appointment_id: appointmentId });
  if (error) {
    logUnexpected("Error al cancelar", error);
    return errorState(bookingErrorMessage(error.message));
  }

  redirect(`/citas/${appointmentId}`);
}

/**
 * Cambia una cita a otro horario (con anticipación, o dentro del plazo después
 * de no asistir). El horario viejo y el nuevo se cambian en una sola
 * transacción: si el nuevo no está libre, la cita original queda igual.
 */
export async function rescheduleAppointmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeFormValues(formData);
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const user = await requireUser(`/citas/${encodeURIComponent(appointmentId)}/reprogramar`);

  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  if (!(await consumeRateLimit("appointment:user", user.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_starts_at: parsed.data.startsAt,
    p_rules_version: parsed.data.rulesVersion,
  });

  if (error || !newId) {
    logUnexpected("Error al reprogramar", error);
    return errorState(bookingErrorMessage(error?.message), undefined, values);
  }

  after(() => sendConfirmationEmail(newId));
  redirect(`/citas/${newId}`);
}

// Errores esperados (de negocio) que no hace falta registrar como fallas.
const KNOWN_CODES = new Set([
  "policy_changed",
  "service_unavailable",
  "invalid_start",
  "outside_booking_window",
  "outside_business_hours",
  "slot_unavailable",
  "payment_in_progress",
  "not_found",
  "not_cancellable",
  "already_started",
  "not_reschedulable",
  "too_late_to_reschedule",
  "reschedule_window_closed",
  "already_rescheduled",
]);

function logUnexpected(context: string, error: { code?: string; message: string } | null) {
  if (!error || !KNOWN_CODES.has(error.message)) {
    console.error(context, error?.code, error?.message);
  }
}
