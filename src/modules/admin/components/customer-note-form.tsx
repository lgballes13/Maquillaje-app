"use client";

import { useActionState, useId } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { saveCustomerNoteAction } from "../customer-actions";
import { CUSTOMER_NOTE_MAX } from "../customers";

/** Nota interna sobre la clienta: alergias, preferencias, acuerdos. Ella no la ve. */
export function CustomerNoteForm({ customerId, note }: { customerId: string; note: string }) {
  const [state, formAction] = useActionState(saveCustomerNoteAction, initialFormState);
  const id = useId();
  const errors = state.fieldErrors?.note;

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid gap-2">
        <Label htmlFor={id}>Nota interna (la clienta no la ve)</Label>
        <textarea
          id={id}
          name="note"
          rows={4}
          maxLength={CUSTOMER_NOTE_MAX}
          defaultValue={state.values?.note ?? note}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? `${id}-error` : undefined}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="Ej.: piel sensible, prefiere tonos cálidos…"
        />
        {errors?.length ? (
          <p id={`${id}-error`} className="text-sm font-medium text-destructive">
            {errors.join(" ")}
          </p>
        ) : null}
      </div>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        Guardar nota
      </SubmitButton>
    </form>
  );
}
