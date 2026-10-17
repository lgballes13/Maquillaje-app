"use server";

import { redirect } from "next/navigation";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { bookingErrorMessage } from "./policy";
import { bookingSchema } from "./schemas";

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
    if (error && !(error.message in KNOWN_CODES)) {
      console.error("Error al reservar", error.code, error.message);
    }
    return errorState(bookingErrorMessage(error?.message), undefined, values);
  }

  redirect(`/citas/${appointmentId}`);
}

// Errores esperados (de negocio) que no hace falta registrar como fallas.
const KNOWN_CODES = {
  policy_changed: true,
  service_unavailable: true,
  invalid_start: true,
  outside_booking_window: true,
  outside_business_hours: true,
  slot_unavailable: true,
  payment_in_progress: true,
};
