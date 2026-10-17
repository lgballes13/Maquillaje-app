"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { signUpAction } from "../actions";
import { PASSWORD_MIN } from "../schemas";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialFormState);

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="Nombre completo"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
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
        label="Celular (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        defaultValue={state.values?.phone}
        hint="Lo usaremos para recordatorios de tus citas."
        errors={state.fieldErrors?.phone}
      />
      <FormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`Mínimo ${PASSWORD_MIN} caracteres. Una frase fácil de recordar funciona muy bien.`}
        errors={state.fieldErrors?.password}
      />
      <CheckboxField
        name="privacyAccepted"
        required
        defaultChecked={state.values?.privacyAccepted === "on"}
        errors={state.fieldErrors?.privacyAccepted}
      >
        Autorizo el tratamiento de mis datos personales según la{" "}
        <Link
          href="/privacidad"
          target="_blank"
          className="text-primary underline underline-offset-4"
        >
          política de tratamiento de datos
        </Link>{" "}
        (Ley 1581 de 2012).
      </CheckboxField>
      <CheckboxField name="marketingOptIn" defaultChecked={state.values?.marketingOptIn === "on"}>
        Quiero recibir novedades y promociones (opcional).
      </CheckboxField>
      <SubmitButton pendingText="Creando tu cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}
