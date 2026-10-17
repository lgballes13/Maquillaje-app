import { CircleAlert, CircleCheck } from "lucide-react";
import type { FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

/**
 * Mensaje general del formulario. role="alert" hace que el lector de pantalla
 * lo anuncie apenas aparece.
 */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  const Icon = isError ? CircleAlert : CircleCheck;

  return (
    <div
      role={isError ? "alert" : "status"}
      data-testid="form-message"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        isError
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-emerald-700/30 bg-emerald-50 text-emerald-900",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{state.message}</p>
    </div>
  );
}
