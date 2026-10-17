import { useId, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends ComponentProps<typeof Input> {
  label: string;
  name: string;
  hint?: string;
  errors?: string[];
}

/**
 * Etiqueta + campo + ayuda + errores, conectados para lectores de pantalla:
 * aria-describedby lee la ayuda y el error; aria-invalid marca el campo con error.
 */
export function FormField({ label, name, hint, errors, ...inputProps }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);
  const describedBy = [hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {errors!.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
