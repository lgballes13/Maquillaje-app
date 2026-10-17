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
  credit_validity_days: number;
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
      `Puedes cambiar el horario o cancelar sin costo hasta ${rules.free_cancellation_hours} horas antes de la cita. Si cancelas, tu anticipo queda como saldo a favor para tu próxima cita.`,
      `Si cancelas con menos de ${rules.free_cancellation_hours} horas, se descuenta el ${penalty} % del anticipo y el resto queda como saldo a favor.`,
      `Si no asistes, tienes ${rules.reschedule_window_hours} horas desde la hora de la cita para reprogramar: se descuenta el ${penalty} % del anticipo y el resto se abona a la nueva cita. Después de ese plazo pierdes el anticipo.`,
      `El saldo a favor vence ${rules.credit_validity_days} días después de generarse y solo se usa para el anticipo de otra cita.`,
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
  not_cancellable: "Esta cita ya no se puede cancelar.",
  already_started: "La cita ya empezó; no se puede cancelar.",
  not_reschedulable: "Esta cita no se puede reprogramar.",
  too_late_to_reschedule:
    "Faltan menos horas de las permitidas para cambiar el horario. Si no puedes asistir, cancela la cita.",
  reschedule_window_closed: "Ya pasó el plazo para reprogramar esta cita.",
  already_rescheduled: "Esta cita ya se reprogramó.",
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
  completed: "Asistió",
  no_show: "No asistió",
  rescheduled: "Reprogramada",
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

const HOUR = 60 * 60 * 1000;

export interface LifecycleRules {
  free_cancellation_hours: number;
  reschedule_window_hours: number;
  reschedule_penalty_percent: number | string;
  credit_validity_days: number;
}

/** Hasta cuándo vale un saldo a favor que se genera ahora (informativo; la base de datos pone la fecha). */
export function creditExpiresAt(
  rules: { credit_validity_days: number },
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() + rules.credit_validity_days * 24 * HOUR);
}

/** Penalidad redondeada hacia arriba al peso (igual que la base de datos). */
export function penaltyFor(depositCop: number, penaltyPercent: number | string): number {
  return depositFor(depositCop, penaltyPercent);
}

/**
 * Qué pasa si la clienta cancela ahora. Es informativo: la base de datos
 * (cancel_appointment) vuelve a calcularlo con la política que aceptó.
 */
export function cancellationPreview(
  appointment: { starts_at: string; deposit_cop: number },
  rules: LifecycleRules,
  now: Date = new Date(),
): { late: boolean; penalty: number; credit: number } {
  const hoursLeft = (new Date(appointment.starts_at).getTime() - now.getTime()) / HOUR;
  if (hoursLeft >= rules.free_cancellation_hours) {
    return { late: false, penalty: 0, credit: appointment.deposit_cop };
  }
  const penalty = penaltyFor(appointment.deposit_cop, rules.reschedule_penalty_percent);
  return { late: true, penalty, credit: appointment.deposit_cop - penalty };
}

export type AppointmentAction =
  | { kind: "pay" }
  | { kind: "change" }
  | { kind: "cancel_only" }
  | { kind: "reschedule_after_no_show"; credit: number; deadline: Date }
  | { kind: "none" };

/** Qué puede hacer la clienta con su cita en este momento. */
export function availableAction(
  appointment: {
    status: AppointmentStatus;
    starts_at: string;
    deposit_cop: number;
    hold_expires_at: string | null;
    rescheduled: boolean;
  },
  rules: LifecycleRules,
  now: Date = new Date(),
): AppointmentAction {
  const status = displayStatus(appointment, now);
  const startsAt = new Date(appointment.starts_at).getTime();
  if (status === "pending_payment") return { kind: "pay" };
  if (status === "confirmed" && startsAt > now.getTime()) {
    const late = (startsAt - now.getTime()) / HOUR < rules.free_cancellation_hours;
    return late ? { kind: "cancel_only" } : { kind: "change" };
  }
  if (status === "no_show" && !appointment.rescheduled) {
    const deadline = new Date(startsAt + rules.reschedule_window_hours * HOUR);
    if (now.getTime() <= deadline.getTime()) {
      const penalty = penaltyFor(appointment.deposit_cop, rules.reschedule_penalty_percent);
      return {
        kind: "reschedule_after_no_show",
        credit: appointment.deposit_cop - penalty,
        deadline,
      };
    }
  }
  return { kind: "none" };
}

/** Cuánto paga hoy la clienta: el anticipo menos el saldo a favor que alcance. */
export function amountDueToday(
  depositCop: number,
  creditBalanceCop: number,
): {
  creditApplied: number;
  due: number;
} {
  const creditApplied = Math.min(Math.max(creditBalanceCop, 0), depositCop);
  return { creditApplied, due: depositCop - creditApplied };
}

export const CREDIT_REASON_LABELS = {
  cancellation: "Cancelación con anticipación",
  late_cancellation: "Cancelación tardía (con descuento)",
  reschedule: "Cambio de horario",
  no_show_reschedule: "Reprogramación después de no asistir (con descuento)",
  applied_to_booking: "Usado en una reserva",
  hold_released: "Devuelto: reserva sin pagar",
  expired: "Vencido",
} as const;
