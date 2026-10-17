"use server";

import { revalidatePath } from "next/cache";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";
import { businessRulesSchema, parseBusinessHoursForm, rulesChanged } from "./schemas";

/*
 * Acciones del panel. Doble protección:
 * 1. requireAdmin() revisa rol + 2FA antes de hacer nada.
 * 2. Las reglas RLS de la base de datos vuelven a revisarlo (is_admin()).
 */

export async function saveBusinessRulesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin/reglas");
  const values = safeFormValues(formData);

  const parsed = businessRulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("business_rules")
    .select("*")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (current && !rulesChanged(current, parsed.data)) {
    return errorState(
      "No cambiaste ningún valor, así que no se creó una versión nueva.",
      undefined,
      values,
    );
  }

  // Nunca se edita una versión: se crea una nueva (queda el historial completo).
  const { data, error } = await supabase
    .from("business_rules")
    .insert(parsed.data)
    .select("version")
    .single();

  if (error) {
    console.error("Error al guardar reglas", error.code, error.message);
    return errorState("No se pudieron guardar las reglas. Intenta de nuevo.", undefined, values);
  }

  revalidatePath("/admin/reglas");
  return { status: "success", message: `Reglas guardadas como versión ${data.version}.` };
}

export async function saveBusinessHoursAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin/reglas");
  const values = safeFormValues(formData);

  const parsed = parseBusinessHoursForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path;
      (fieldErrors[`${String(field ?? "closes_at")}-${String(index)}`] ??= []).push(issue.message);
    }
    return errorState("Revisa el horario marcado.", fieldErrors, values);
  }

  const supabase = await createClient();
  for (const day of parsed.data) {
    const { error } = await supabase
      .from("business_hours")
      .update(
        day.is_open
          ? { is_open: true, opens_at: day.opens_at, closes_at: day.closes_at }
          : { is_open: false, opens_at: null, closes_at: null },
      )
      .eq("weekday", day.weekday);
    if (error) {
      console.error("Error al guardar horario", error.code, error.message);
      return errorState("No se pudo guardar el horario. Intenta de nuevo.", undefined, values);
    }
  }

  revalidatePath("/admin/reglas");
  return { status: "success", message: "Horario guardado." };
}
