"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { cancelAppointmentAction } from "../actions";

export function CancelAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const [state, formAction] = useActionState(cancelAppointmentAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <SubmitButton pendingText="Cancelando…" className="w-full sm:w-auto">
        Sí, cancelar mi cita
      </SubmitButton>
      <Link
        href={`/citas/${appointmentId}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        No, volver a mi cita
      </Link>
    </form>
  );
}
