"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PRIVACY_POLICY_VERSION } from "@/config/legal";
import { siteConfig } from "@/config/site";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { safeRedirectPath } from "@/lib/security/redirect";
import { consumeRateLimits, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requestResetSchema, signInSchema, signUpSchema, updatePasswordSchema } from "./schemas";

/*
 * Server Actions de autenticación. Corren SOLO en el servidor.
 * Next.js las protege contra CSRF: rechaza peticiones cuyo origen (Origin)
 * no coincide con el dominio del sitio.
 */

const GENERIC_ERROR = "No pudimos completar la solicitud. Intenta de nuevo en un momento.";

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = safeFormValues(formData);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const ip = await getClientIp();
  if (!(await consumeRateLimits([{ name: "signup:ip", identifier: ip }]))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const { fullName, email, phone, password, marketingOptIn } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteConfig.url}/auth/callback?next=/cuenta`,
      // Estos datos los lee el trigger de la base de datos para crear el perfil.
      data: {
        full_name: fullName,
        phone: phone ?? null,
        privacy_accepted: true,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        marketing_opt_in: marketingOptIn,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return errorState(
        "Revisa los campos marcados.",
        { password: ["Esa contraseña es muy fácil de adivinar. Usa una frase más larga."] },
        values,
      );
    }
    // Para no revelar qué correos ya tienen cuenta, respondemos igual que si todo saliera bien.
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "success", message: CHECK_EMAIL_MESSAGE };
    }
    console.error("Error en el registro", error.code, error.message);
    return errorState(GENERIC_ERROR, undefined, values);
  }

  // Si la confirmación por correo está desactivada (desarrollo), ya hay sesión.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/cuenta");
  }
  return { status: "success", message: CHECK_EMAIL_MESSAGE };
}

const CHECK_EMAIL_MESSAGE =
  "¡Listo! Te enviamos un correo para confirmar tu cuenta. Abre el enlace para terminar el registro.";

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = safeFormValues(formData);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { email, password, next } = parsed.data;
  const ip = await getClientIp();
  const allowed = await consumeRateLimits([
    { name: "login:ip", identifier: ip },
    { name: "login:email", identifier: email },
  ]);
  if (!allowed) return errorState(RATE_LIMIT_MESSAGE, undefined, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return errorState(
        "Primero confirma tu correo: revisa tu bandeja de entrada.",
        undefined,
        values,
      );
    }
    // Mismo mensaje si el correo no existe o la clave está mal (no revelamos cuál).
    return errorState("Correo o contraseña incorrectos.", undefined, values);
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(next));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

const RESET_SENT_MESSAGE =
  "Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.";

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = safeFormValues(formData);
  const parsed = requestResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { email } = parsed.data;
  const ip = await getClientIp();
  const allowed = await consumeRateLimits([
    { name: "reset:ip", identifier: ip },
    { name: "reset:email", identifier: email },
  ]);
  if (!allowed) return errorState(RATE_LIMIT_MESSAGE, undefined, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteConfig.url}/auth/callback?next=/restablecer`,
  });
  if (error) console.error("Error al pedir el cambio de contraseña", error.code, error.message);

  // Siempre la misma respuesta, exista o no la cuenta.
  return { status: "success", message: RESET_SENT_MESSAGE };
}

export async function updatePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return errorState("El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") {
      return errorState("Revisa los campos marcados.", {
        password: ["Esa contraseña es muy fácil de adivinar. Usa una frase más larga."],
      });
    }
    if (error.code === "same_password") {
      return errorState("Revisa los campos marcados.", {
        password: ["La contraseña nueva debe ser distinta a la anterior."],
      });
    }
    console.error("Error al cambiar la contraseña", error.code, error.message);
    return errorState(GENERIC_ERROR);
  }

  revalidatePath("/", "layout");
  redirect("/cuenta?clave=actualizada");
}
