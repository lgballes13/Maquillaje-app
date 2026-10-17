"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { toggleWaitlistAction } from "../actions";

/**
 * Lista de espera sin pago. «waiting» = inscrita y aún sin aviso; si ya la
 * avisamos, puede inscribirse otra vez para el próximo regreso.
 */
export function WaitlistForm({ productId, waiting }: { productId: string; waiting: boolean }) {
  const [state, formAction] = useActionState(toggleWaitlistAction, initialFormState);
  return (
    <form action={formAction} className="grid gap-3" data-testid="waitlist-form">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="intent" value={waiting ? "leave" : "join"} />
      {waiting ? (
        <p className="text-sm" data-testid="waitlist-status">
          Te escribiremos al correo cuando vuelva.
        </p>
      ) : null}
      <div>
        <SubmitButton pendingText="Guardando…" className="w-full sm:w-auto">
          {waiting ? "Ya no quiero el aviso" : "Avísame cuando llegue"}
        </SubmitButton>
      </div>
    </form>
  );
}
