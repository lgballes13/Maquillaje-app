import { useId, type ReactNode } from "react";

interface CheckboxFieldProps {
  name: string;
  children: ReactNode;
  errors?: string[];
  required?: boolean;
  defaultChecked?: boolean;
}

/** Casilla con texto. Toda la fila es clickeable y mide al menos 44 px de alto. */
export function CheckboxField({
  name,
  children,
  errors,
  required,
  defaultChecked,
}: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
        <input
          id={id}
          name={name}
          type="checkbox"
          required={required}
          defaultChecked={defaultChecked}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>{children}</span>
      </label>
      {hasError ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {errors!.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
