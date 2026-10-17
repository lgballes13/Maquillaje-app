"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { updatePasswordAction } from "../actions";
import { PASSWORD_MIN } from "../schemas";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`Mínimo ${PASSWORD_MIN} caracteres.`}
        errors={state.fieldErrors?.password}
      />
      <FormField
        label="Repite la contraseña nueva"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
