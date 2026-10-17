"use client";

import { useActionState, useId } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { saveConsentAction } from "../admin-actions";
import { FileField } from "./file-field";

/** Registra la autorización firmada de una clienta (nombre, fecha y el formato). */
export function ConsentForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(saveConsentAction, initialFormState);
  const notesId = useId();
  const value = (name: string, fallback = "") =>
    state.status === "success" ? fallback : (state.values?.[name] ?? fallback);

  return (
    // key: tras guardar, el formulario se limpia (incluido el archivo).
    <form
      key={state.status === "success" ? state.message : "form"}
      action={formAction}
      className="grid gap-4"
      noValidate
    >
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="clientName"
          label="Nombre de la clienta"
          autoComplete="off"
          required
          maxLength={100}
          defaultValue={value("clientName")}
          errors={state.fieldErrors?.clientName}
        />
        <FormField
          name="signedOn"
          label="Fecha en que firmó"
          type="date"
          max={today}
          required
          defaultValue={value("signedOn", today)}
          errors={state.fieldErrors?.signedOn}
        />
      </div>
      <FileField
        name="document"
        label="Formato firmado (foto o PDF, máximo 5 MB)"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hint="Se guarda en privado: solo tú lo puedes ver."
        errors={state.fieldErrors?.document}
      />
      <div className="grid gap-2">
        <Label htmlFor={notesId}>Notas (opcional)</Label>
        <textarea
          id={notesId}
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={value("notes")}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        Registrar autorización
      </SubmitButton>
    </form>
  );
}
