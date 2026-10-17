"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { signInAction } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signInAction, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
      <FormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <Link
        href="/recuperar"
        className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>
      <SubmitButton pendingText="Ingresando…">Ingresar</SubmitButton>
    </form>
  );
}
