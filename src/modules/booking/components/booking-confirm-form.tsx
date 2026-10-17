"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { createBookingAction } from "../actions";

export function BookingConfirmForm({
  serviceId,
  startsAt,
  rulesVersion,
  requiresPayment,
}: {
  serviceId: string;
  startsAt: string;
  rulesVersion: number;
  requiresPayment: boolean;
}) {
  const [state, formAction] = useActionState(createBookingAction, initialFormState);
  const notesId = useId();

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="rulesVersion" value={rulesVersion} />

      <div className="grid gap-2">
        <Label htmlFor={notesId}>Notas para la maquilladora (opcional)</Label>
        <textarea
          id={notesId}
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={state.values?.notes}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="Ej.: el evento es a las 7 p. m., tengo piel sensible…"
        />
      </div>

      <CheckboxField
        name="acceptPolicy"
        required
        defaultChecked={state.values?.acceptPolicy === "on"}
        errors={state.fieldErrors?.acceptPolicy}
      >
        Leí y acepto la política de citas, anticipos y cancelaciones.
      </CheckboxField>

      <SubmitButton pendingText="Apartando tu horario…" className="w-full sm:w-auto">
        {requiresPayment ? "Apartar horario y continuar al pago" : "Confirmar cita"}
      </SubmitButton>
      <Link
        href={`/agendar/${serviceId}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        Elegir otro horario
      </Link>
    </form>
  );
}
