import { z } from "zod";

// Reglas de contraseña según OWASP ASVS: mínimo 12 caracteres, máximo 128,
// sin exigir mayúsculas/símbolos (eso no la hace más segura y molesta).
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const email = z
  .string({ message: "Escribe tu correo" })
  .trim()
  .toLowerCase()
  .min(1, "Escribe tu correo")
  .max(254, "El correo es demasiado largo")
  .pipe(z.email("Escribe un correo válido, por ejemplo nombre@correo.com"));

const password = z
  .string({ message: "Escribe una contraseña" })
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `La contraseña puede tener máximo ${PASSWORD_MAX} caracteres`);

/** Convierte "300 123 4567" o "+57 300-123-4567" en "+573001234567". Asume Colombia si no hay indicativo. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  return `+${digits}`;
}

const phone = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : normalizePhone(value)))
  .pipe(
    z
      .string()
      .regex(/^\+\d{8,15}$/, "Escribe un celular válido, por ejemplo 300 123 4567")
      .optional(),
  );

// Las casillas de un formulario HTML envían "on" si están marcadas y nada si no.
const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export const signUpSchema = z.object({
  fullName: z
    .string({ message: "Escribe tu nombre" })
    .trim()
    .min(2, "Escribe tu nombre completo")
    .max(100, "El nombre es demasiado largo"),
  email,
  phone: phone.optional(),
  password,
  privacyAccepted: checkbox.refine((value) => value, {
    message: "Debes autorizar el tratamiento de tus datos para crear la cuenta",
  }),
  marketingOptIn: checkbox,
});

export const signInSchema = z.object({
  email,
  // En el login no validamos el largo: solo decimos "correo o contraseña incorrectos".
  password: z.string().min(1, "Escribe tu contraseña").max(PASSWORD_MAX),
  next: z.string().optional(),
});

export const requestResetSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 números"),
});

export const enrollVerifySchema = totpCodeSchema.extend({
  factorId: z.uuid("Vuelve a generar el código QR"),
});
