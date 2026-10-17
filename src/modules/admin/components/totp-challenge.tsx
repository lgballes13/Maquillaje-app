"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { verifyTotpChallengeAction } from "@/modules/auth/mfa-actions";

export function TotpChallenge({ next }: { next: string }) {
  const [state, formAction] = useActionState(verifyTotpChallengeAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <FormField
        label="Código de 6 números"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        errors={state.fieldErrors?.code}
      />
      <SubmitButton pendingText="Verificando…">Verificar</SubmitButton>
    </form>
  );
}
