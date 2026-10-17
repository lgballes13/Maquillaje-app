"use client";

import { useActionState, useId } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { uploadWorkImageAction } from "../admin-actions";
import { IMAGE_KIND_LABELS } from "../labels";
import { FileField } from "./file-field";

/** Sube una foto de antes o de después (JPG, PNG o WebP de hasta 5 MB). */
export function WorkImageForm({ workId }: { workId: string }) {
  const [state, formAction] = useActionState(uploadWorkImageAction, initialFormState);
  const legendId = useId();
  const kind = state.status === "success" ? "after" : (state.values?.kind ?? "after");

  return (
    <form
      key={state.status === "success" ? state.message : "form"}
      action={formAction}
      className="grid gap-4"
      noValidate
    >
      <FormMessage state={state} />
      <input type="hidden" name="workId" value={workId} />
      <fieldset className="grid gap-2" aria-labelledby={legendId}>
        <legend id={legendId} className="text-sm font-medium">
          ¿Es la foto de antes o de después?
        </legend>
        <div className="flex flex-wrap gap-2">
          {(["after", "before"] as const).map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm has-checked:border-primary"
            >
              <input
                type="radio"
                name="kind"
                value={option}
                defaultChecked={kind === option}
                className="size-5 accent-primary"
              />
              {IMAGE_KIND_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
      <FileField
        name="image"
        label="Foto del trabajo (JPG, PNG o WebP, máximo 5 MB)"
        accept="image/jpeg,image/png,image/webp"
        errors={state.fieldErrors?.image}
      />
      <FormField
        name="altText"
        label="Descripción de la foto"
        hint="Para personas con lectores de pantalla. Ej.: maquillaje de novia con labios nude."
        required
        maxLength={150}
        defaultValue={state.status === "success" ? "" : (state.values?.altText ?? "")}
        errors={state.fieldErrors?.altText}
      />
      <SubmitButton pendingText="Subiendo…" className="sm:justify-self-start">
        Subir foto
      </SubmitButton>
    </form>
  );
}
