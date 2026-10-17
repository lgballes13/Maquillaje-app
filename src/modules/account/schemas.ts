import { z } from "zod";

/** Palabra que la clienta escribe para confirmar que quiere eliminar su cuenta. */
export const CLOSE_ACCOUNT_WORD = "ELIMINAR";

export const closeAccountSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña."),
  confirmation: z
    .string()
    .trim()
    .refine((value) => value.toUpperCase() === CLOSE_ACCOUNT_WORD, {
      message: `Escribe ${CLOSE_ACCOUNT_WORD} para confirmar.`,
    }),
});

const CLOSE_ACCOUNT_ERRORS: Record<string, string> = {
  active_appointments:
    "Tienes una cita pendiente. Cancélala o espera a que pase antes de eliminar tu cuenta.",
  open_orders:
    "Tienes un pedido en curso. Espera a recibirlo (o cancélalo) antes de eliminar tu cuenta.",
  staff_account: "Las cuentas del equipo no se eliminan desde aquí.",
};

export function closeAccountErrorMessage(code: string | undefined): string {
  return (
    (code && CLOSE_ACCOUNT_ERRORS[code]) ??
    "No pudimos eliminar tu cuenta. Intenta de nuevo o escríbenos."
  );
}
