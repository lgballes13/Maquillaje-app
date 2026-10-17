"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";

/** Campo de archivo con su etiqueta, ayuda y errores (conectados para lectores de pantalla). */
export function FileField({
  name,
  label,
  accept,
  hint,
  errors,
}: {
  name: string;
  label: string;
  accept: string;
  hint?: string;
  errors?: string[];
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-ayuda` : null, errors ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required
        aria-invalid={Boolean(errors) || undefined}
        aria-describedby={describedBy || undefined}
        className="min-h-11 text-base file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-card file:px-3"
      />
      {hint ? (
        <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
