"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { createBlockAction } from "../actions";

/** Bloquea una franja de la agenda (vacaciones, cita médica, evento externo). */
export function BlockForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(createBlockAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="startDate"
          label="Desde (fecha)"
          type="date"
          min={today}
          required
          defaultValue={state.values?.startDate ?? today}
          errors={state.fieldErrors?.startDate}
        />
        <FormField
          name="startTime"
          label="Desde (hora)"
          type="time"
          required
          defaultValue={state.values?.startTime ?? "00:00"}
          errors={state.fieldErrors?.startTime}
        />
        <FormField
          name="endDate"
          label="Hasta (fecha)"
          type="date"
          min={today}
          required
          defaultValue={state.values?.endDate ?? today}
          errors={state.fieldErrors?.endDate}
        />
        <FormField
          name="endTime"
          label="Hasta (hora)"
          type="time"
          required
          defaultValue={state.values?.endTime ?? "23:59"}
          errors={state.fieldErrors?.endTime}
        />
      </div>
      <FormField
        name="reason"
        label="Motivo (solo lo ves tú)"
        maxLength={200}
        defaultValue={state.values?.reason}
        errors={state.fieldErrors?.reason}
      />
      <SubmitButton pendingText="Bloqueando…" className="sm:justify-self-start">
        Bloquear horario
      </SubmitButton>
    </form>
  );
}
