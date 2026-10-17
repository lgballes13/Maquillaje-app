/*
 * Textos de la política de citas y mensajes de error de la reserva.
 * Los montos que se muestran aquí son informativos: el valor que se cobra lo
 * calcula la base de datos (create_booking) con la misma fórmula.
 */

export interface PolicyRules {
  deposit_percent: number | string;
  free_cancellation_hours: number;
  reschedule_window_hours: number;
  reschedule_penalty_percent: number | string;
  booking_hold_minutes: number;
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** 90000 → "$ 90.000" */
export function formatCop(value: number): string {
  return copFormatter.format(value).replace(/ /g, " ");
}

/** Anticipo redondeado hacia arriba al peso (igual que la base de datos). */
export function depositFor(priceCop: number, depositPercent: number | string): number {
  // Se trabaja en centésimas de % para evitar errores de decimales (ej.: 33,33 %).
  const basisPoints = Math.round(Number(depositPercent) * 100);
  return Math.ceil((priceCop * basisPoints) / 10000);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Puntos de la política que la clienta acepta antes de pagar. */
export function policyPoints(rules: PolicyRules): string[] {
  const deposit = Number(rules.deposit_percent);
  const penalty = Number(rules.reschedule_penalty_percent);
  const points = [
    deposit > 0
      ? `Para reservar pagas un anticipo del ${deposit} % del valor del servicio. El resto se paga el día de la cita.`
      : "Esta reserva no requiere anticipo.",
  ];
  if (deposit > 0) {
    points.push(
      `Tienes ${rules.booking_hold_minutes} minutos para pagar; si no, el horario se libera para otra persona.`,
      `Si cancelas con al menos ${rules.free_cancellation_hours} horas de anticipación, tu anticipo queda como saldo a favor.`,
      `Si no asistes, tienes ${rules.reschedule_window_hours} horas para reprogramar; se descuenta el ${penalty} % del anticipo y el resto queda abonado.`,
    );
  }
  return points;
}

const BOOKING_ERRORS: Record<string, string> = {
  not_authenticated: "Tu sesión terminó. Ingresa de nuevo para reservar.",
  policy_changed:
    "La política de citas cambió mientras reservabas. Revísala de nuevo y vuelve a aceptarla.",
  service_unavailable: "Este servicio ya no está disponible.",
  invalid_start: "El horario elegido no es válido. Elige otro.",
  outside_booking_window: "Ese horario ya no se puede reservar. Elige otro.",
  outside_business_hours: "Ese horario está fuera de la hora de atención. Elige otro.",
  slot_unavailable: "Alguien acaba de tomar ese horario. Elige otro, por favor.",
  payment_in_progress:
    "Tienes un pago en proceso. Espera a que termine antes de reservar otro horario.",
  not_found: "No encontramos esa cita.",
  hold_expired: "Se acabó el tiempo para pagar y el horario se liberó. Reserva de nuevo.",
  already_paid: "Esta cita ya está pagada.",
};

/** Traduce el código de error de la base de datos a un mensaje para la clienta. */
export function bookingErrorMessage(code: string | undefined): string {
  return (
    (code && BOOKING_ERRORS[code]) ??
    "No pudimos completar la reserva. Intenta de nuevo en un momento."
  );
}

export const APPOINTMENT_STATUS_LABELS = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  expired: "Vencida (no se pagó a tiempo)",
  cancelled: "Cancelada",
} as const;

type AppointmentStatus = keyof typeof APPOINTMENT_STATUS_LABELS;

/**
 * Estado para mostrar: si el tiempo para pagar ya pasó, la cita se ve como
 * vencida aunque la base de datos todavía no la haya marcado.
 */
export function displayStatus(
  appointment: { status: AppointmentStatus; hold_expires_at: string | null },
  now: Date = new Date(),
): AppointmentStatus {
  if (
    appointment.status === "pending_payment" &&
    appointment.hold_expires_at !== null &&
    new Date(appointment.hold_expires_at).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return appointment.status;
}
