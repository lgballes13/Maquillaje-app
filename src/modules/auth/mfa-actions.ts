"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorState, zodFieldErrors, type FormState } from "@/lib/forms";
import { safeRedirectPath } from "@/lib/security/redirect";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { enrollVerifySchema, totpCodeSchema } from "./schemas";
import { getCurrentUser, isAdminUser } from "./session";

/*
 * Segundo factor (2FA) con app autenticadora (Google Authenticator, Authy,
 * Microsoft Authenticator…). Obligatorio para el rol admin.
 */

export interface EnrollResult {
  status: "ok" | "error";
  message?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

/** Paso 1: genera el código QR que se escanea con la app autenticadora. */
export async function startTotpEnrollmentAction(): Promise<EnrollResult> {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser())) return { status: "error", message: "No autorizado." };

  const supabase = await createClient();

  // Borra intentos anteriores sin terminar para no acumular factores sin verificar.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  if ((factors?.totp ?? []).some((f) => f.status === "verified")) {
    return { status: "error", message: "Ya tienes un segundo factor configurado." };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: siteConfig.name,
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) {
    console.error("Error al iniciar 2FA", error?.code, error?.message);
    return { status: "error", message: "No pudimos generar el código QR. Intenta de nuevo." };
  }

  return { status: "ok", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Paso 2: confirma el código de 6 números para activar el segundo factor. */
export async function verifyTotpEnrollmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Tu sesión venció. Vuelve a iniciar sesión.");

  const parsed = enrollVerifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa el código.", zodFieldErrors(parsed.error));

  if (!(await consumeRateLimit("mfa:user", user.id))) return errorState(RATE_LIMIT_MESSAGE);

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) {
    return errorState("El código no es válido o ya venció. Escribe el que muestra la app ahora.", {
      code: ["Código incorrecto"],
    });
  }

  revalidatePath("/", "layout");
  redirect("/admin");
}

/** Inicio de sesión del admin: pide el código para subir la sesión a nivel aal2. */
export async function verifyTotpChallengeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return errorState("Tu sesión venció. Vuelve a iniciar sesión.");

  const parsed = totpCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa el código.", zodFieldErrors(parsed.error));

  if (!(await consumeRateLimit("mfa:user", user.id))) return errorState(RATE_LIMIT_MESSAGE);

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/admin/seguridad");

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (error) {
    return errorState("El código no es válido o ya venció. Escribe el que muestra la app ahora.", {
      code: ["Código incorrecto"],
    });
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("next"), "/admin"));
}
