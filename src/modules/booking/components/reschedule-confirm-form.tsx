"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { rescheduleAppointmentAction } from "../actions";

export function RescheduleConfirmForm({
  appointmentId,
  startsAt,
  rulesVersion,
  requiresPayment,
}: {
  appointmentId: string;
  startsAt: string;
  rulesVersion: number;
  requiresPayment: boolean;
}) {
  const [state, formAction] = useActionState(rescheduleAppointmentAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="rulesVersion" value={rulesVersion} />

      <CheckboxField
        name="acceptPolicy"
        required
        defaultChecked={state.values?.acceptPolicy === "on"}
        errors={state.fieldErrors?.acceptPolicy}
      >
        Leí y acepto la política de citas, anticipos y cancelaciones.
      </CheckboxField>

      <SubmitButton pendingText="Cambiando tu horario…" className="w-full sm:w-auto">
        {requiresPayment ? "Cambiar horario y continuar al pago" : "Confirmar nuevo horario"}
      </SubmitButton>
      <Link
        href={`/citas/${appointmentId}/reprogramar`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        Elegir otro horario
      </Link>
    </form>
  );
}
