"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveBusinessRulesAction } from "../actions";
import type { BusinessRulesInput } from "../schemas";

type Rules = Omit<BusinessRulesInput, "change_reason">;

// Cada campo con su etiqueta, explicación y límites.
const FIELDS: {
  name: keyof Rules;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  {
    name: "deposit_percent",
    label: "Anticipo para reservar",
    hint: "Porcentaje del valor del servicio que se paga al reservar.",
    min: 0,
    max: 100,
    step: 0.01,
    unit: "%",
  },
  {
    name: "free_cancellation_hours",
    label: "Cancelación sin penalidad",
    hint: "Si cancela con al menos estas horas de anticipación, todo el anticipo queda como saldo a favor.",
    min: 0,
    max: 720,
    step: 1,
    unit: "horas",
  },
  {
    name: "credit_validity_days",
    label: "Vigencia del saldo a favor",
    hint: "Días que dura el saldo a favor desde que se genera. Después vence y no se puede usar.",
    min: 1,
    max: 365,
    step: 1,
    unit: "días",
  },
  {
    name: "reschedule_window_hours",
    label: "Plazo para reprogramar tras no asistir",
    hint: "Horas que tiene la clienta, después de la cita perdida, para reprogramar y conservar parte del anticipo.",
    min: 1,
    max: 720,
    step: 1,
    unit: "horas",
  },
  {
    name: "reschedule_penalty_percent",
    label: "Penalidad al reprogramar",
    hint: "Porcentaje del anticipo que se pierde al reprogramar dentro del plazo. El resto queda abonado.",
    min: 0,
    max: 100,
    step: 0.01,
    unit: "%",
  },
  {
    name: "buffer_minutes",
    label: "Preparación entre citas",
    hint: "Minutos libres entre una cita y la siguiente.",
    min: 0,
    max: 240,
    step: 1,
    unit: "minutos",
  },
  {
    name: "booking_hold_minutes",
    label: "Tiempo para pagar",
    hint: "Minutos que se aparta el horario mientras la clienta paga.",
    min: 5,
    max: 30,
    step: 1,
    unit: "minutos",
  },
  {
    name: "min_booking_notice_hours",
    label: "Anticipación mínima para reservar",
    hint: "No se puede reservar una cita que empiece antes de estas horas.",
    min: 0,
    max: 720,
    step: 1,
    unit: "horas",
  },
  {
    name: "max_booking_days_ahead",
    label: "Reservas hacia adelante",
    hint: "Hasta cuántos días en el futuro se puede reservar.",
    min: 1,
    max: 365,
    step: 1,
    unit: "días",
  },
  {
    name: "preorder_deposit_percent",
    label: "Anticipo de preventa",
    hint: "Porcentaje del precio que se paga al reservar un producto agotado.",
    min: 0,
    max: 100,
    step: 0.01,
    unit: "%",
  },
  {
    name: "preorder_delivery_days",
    label: "Entrega estimada de preventa",
    hint: "Días que se informan como tiempo estimado de llegada.",
    min: 1,
    max: 365,
    step: 1,
    unit: "días",
  },
];

export function RulesForm({ current }: { current: Rules }) {
  const [state, formAction] = useActionState(saveBusinessRulesAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <FormField
            key={field.name}
            name={field.name}
            label={`${field.label} (${field.unit})`}
            hint={field.hint}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step}
            required
            defaultValue={state.values?.[field.name] ?? String(current[field.name])}
            errors={state.fieldErrors?.[field.name]}
          />
        ))}
      </div>
      <FormField
        name="change_reason"
        label="Motivo del cambio"
        hint="Queda guardado en el historial. Ej.: «Nueva política para temporada de bodas»."
        required
        maxLength={500}
        defaultValue={state.values?.change_reason}
        errors={state.fieldErrors?.change_reason}
      />
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        Guardar como versión nueva
      </SubmitButton>
    </form>
  );
}
