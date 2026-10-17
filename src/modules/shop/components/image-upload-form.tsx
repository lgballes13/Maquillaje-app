"use client";

import { useActionState, useId } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { uploadProductImageAction } from "../admin-actions";

/** Sube una foto de un producto (JPG, PNG o WebP de hasta 5 MB). */
export function ImageUploadForm({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [state, formAction] = useActionState(uploadProductImageAction, initialFormState);
  const fileId = useId();
  const errors = state.fieldErrors?.image;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-2">
        <Label htmlFor={fileId}>Foto (JPG, PNG o WebP, máximo 5 MB)</Label>
        <input
          id={fileId}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-invalid={Boolean(errors) || undefined}
          aria-describedby={errors ? `${fileId}-error` : undefined}
          className="min-h-11 text-base file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-card file:px-3"
        />
        {errors ? (
          <p id={`${fileId}-error`} className="text-sm font-medium text-destructive">
            {errors.join(" ")}
          </p>
        ) : null}
      </div>
      <FormField
        name="altText"
        label="Descripción de la foto"
        hint="Para personas con lectores de pantalla. Ej.: labial rojo abierto."
        required
        maxLength={150}
        defaultValue={state.status === "success" ? "" : (state.values?.altText ?? productName)}
        errors={state.fieldErrors?.altText}
      />
      <SubmitButton pendingText="Subiendo…" className="sm:justify-self-start">
        Subir foto
      </SubmitButton>
    </form>
  );
}
