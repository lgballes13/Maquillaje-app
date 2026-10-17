"use server";

import { randomBytes } from "node:crypto";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/env";
import { errorState, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { closeAccountErrorMessage, closeAccountSchema } from "./schemas";

/** Comprueba la contraseña sin tocar la sesión actual (cliente aparte, sin cookies). */
async function passwordMatches(email: string, password: string): Promise<boolean> {
  const { url, anonKey } = getSupabasePublicConfig();
  const client = createStatelessClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;
  await client.auth.signOut();
  return true;
}

/**
 * Elimina la cuenta de la clienta (Ley 1581, derecho de supresión).
 * 1. La base borra o anonimiza sus datos de contacto (close_my_account).
 * 2. Sin historial, se borra el usuario. Con historial, se bloquea el acceso y
 *    se cambia el correo: las citas y pedidos quedan sin datos de contacto.
 */
export async function closeAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/cuenta");
  const parsed = closeAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), {
      confirmation: String(formData.get("confirmation") ?? ""),
    });
  }
  if (!(await consumeRateLimit("account:user", user.id))) return errorState(RATE_LIMIT_MESSAGE);
  if (!user.email || !(await passwordMatches(user.email, parsed.data.password))) {
    return errorState("Revisa los campos marcados.", {
      password: ["La contraseña no es correcta."],
    });
  }

  const supabase = await createClient();
  const { data: mode, error } = await supabase.rpc("close_my_account");
  if (error) {
    if (error.code !== "P0001")
      console.error("Error al cerrar la cuenta", error.code, error.message);
    return errorState(closeAccountErrorMessage(error.message));
  }
  await supabase.auth.signOut();

  const admin = createAdminClient();
  const { error: authError } =
    mode === "delete"
      ? await admin.auth.admin.deleteUser(user.id)
      : await admin.auth.admin.updateUserById(user.id, {
          email: `eliminada-${user.id}@cuenta-eliminada.invalid`,
          email_confirm: true,
          password: randomBytes(32).toString("base64url"),
          user_metadata: {},
          ban_duration: "876000h",
        });
  if (authError) {
    // Los datos ya se borraron; solo falló bloquear el acceso. Queda en el registro para revisarlo.
    console.error("Error al bloquear la cuenta eliminada", authError.code, authError.message);
  }

  revalidatePath("/", "layout");
  redirect("/cuenta-eliminada");
}
