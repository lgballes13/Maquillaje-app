"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { requestPasswordResetAction } from "../actions";

export function RequestResetForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialFormState);

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton>Enviar enlace</SubmitButton>
    </form>
  );
}
