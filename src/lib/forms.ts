import type { z } from "zod";

/** Estado que devuelven las server actions a los formularios. */
export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /**
   * Valores enviados, para volver a mostrarlos si hay un error (React limpia el
   * formulario después de cada envío). NUNCA incluyas contraseñas aquí.
   */
  values?: Record<string, string>;
}

export const initialFormState: FormState = { status: "idle" };

/** Convierte un error de Zod en mensajes por campo para mostrar bajo cada input. */
export function zodFieldErrors(error: z.ZodError): FormState["fieldErrors"] {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

export function errorState(
  message: string,
  fieldErrors?: FormState["fieldErrors"],
  values?: FormState["values"],
): FormState {
  return { status: "error", message, fieldErrors, values };
}

/** Copia del formulario sin los campos sensibles (contraseñas, códigos). */
export function safeFormValues(formData: FormData, exclude: string[] = []): Record<string, string> {
  const blocked = new Set(["password", "confirmPassword", "code", ...exclude]);
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!blocked.has(key) && typeof value === "string" && !key.startsWith("$ACTION")) {
      values[key] = value;
    }
  }
  return values;
}
