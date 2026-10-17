"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { revokeConsentAction } from "../admin-actions";

/** La clienta retiró la autorización: oculta sus trabajos y borra sus fotos. Pide confirmación. */
export function RevokeConsentForm({
  consentId,
  clientName,
}: {
  consentId: string;
  clientName: string;
}) {
  const [state, formAction] = useActionState(revokeConsentAction, initialFormState);
  return (
    <form
      action={formAction}
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        if (
          !window.confirm(
            `¿Registrar que ${clientName} retiró la autorización? Sus trabajos se ocultan y sus fotos se borran. No se puede deshacer.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <FormMessage state={state} />
      <input type="hidden" name="consentId" value={consentId} />
      <FormField
        name="reason"
        label="Motivo"
        hint="Ej.: la clienta lo pidió por WhatsApp el 20 de octubre."
        required
        maxLength={300}
        defaultValue={state.values?.reason ?? ""}
        errors={state.fieldErrors?.reason}
      />
      <SubmitButton pendingText="Retirando…" className="sm:justify-self-start">
        Retirar autorización<span className="sr-only"> de {clientName}</span>
      </SubmitButton>
    </form>
  );
}
