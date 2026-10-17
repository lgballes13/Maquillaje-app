"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { closeAccountAction } from "../actions";
import { CLOSE_ACCOUNT_WORD } from "../schemas";

/** Eliminar la cuenta: pide la contraseña y escribir una palabra para evitar errores. */
export function CloseAccountForm() {
  const [state, formAction] = useActionState(closeAccountAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="password"
        label="Tu contraseña"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <FormField
        name="confirmation"
        label={`Escribe ${CLOSE_ACCOUNT_WORD} para confirmar`}
        autoComplete="off"
        autoCapitalize="characters"
        required
        defaultValue={state.values?.confirmation}
        errors={state.fieldErrors?.confirmation}
      />
      <SubmitButton
        variant="destructive"
        pendingText="Eliminando…"
        className="sm:justify-self-start"
      >
        Eliminar mi cuenta
      </SubmitButton>
    </form>
  );
}
