"use client";

import { useActionState, useState, useTransition } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";
import {
  startTotpEnrollmentAction,
  verifyTotpEnrollmentAction,
  type EnrollResult,
} from "@/modules/auth/mfa-actions";

/** Configuración del segundo factor: generar QR → escanear → confirmar código. */
export function TotpEnrollment() {
  const [enrollment, setEnrollment] = useState<EnrollResult | null>(null);
  const [isStarting, startTransition] = useTransition();
  const [state, formAction] = useActionState(verifyTotpEnrollmentAction, initialFormState);

  if (!enrollment || enrollment.status === "error") {
    return (
      <div className="grid gap-4">
        {enrollment?.message ? (
          <FormMessage state={{ status: "error", message: enrollment.message }} />
        ) : null}
        <Button
          type="button"
          disabled={isStarting}
          onClick={() =>
            startTransition(async () => setEnrollment(await startTotpEnrollmentAction()))
          }
        >
          {isStarting ? "Generando…" : "Generar código QR"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <ol className="grid list-decimal gap-2 pl-5 text-sm">
        <li>Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator o Authy).</li>
        <li>Toca «Agregar» y escanea este código QR.</li>
        <li>Escribe abajo el código de 6 números que aparece en la app.</li>
      </ol>
      {/* El QR es una imagen SVG generada por Supabase. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enrollment.qrCode}
        alt="Código QR para configurar la app autenticadora"
        width={200}
        height={200}
        className="justify-self-center rounded-lg border border-border bg-white p-2"
      />
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium">
          ¿No puedes escanear? Escribe la clave a mano
        </summary>
        <code
          data-testid="totp-secret"
          className="mt-2 block rounded bg-muted p-3 font-mono break-all"
        >
          {enrollment.secret}
        </code>
      </details>
      <form action={formAction} className="grid gap-4" noValidate>
        <FormMessage state={state} />
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <FormField
          label="Código de 6 números"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          errors={state.fieldErrors?.code}
        />
        <SubmitButton pendingText="Verificando…">Activar verificación en dos pasos</SubmitButton>
      </form>
    </div>
  );
}
