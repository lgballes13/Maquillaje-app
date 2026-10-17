"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { zonedDateTimeToUtc } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/session";
import {
  blockSchema,
  businessRulesSchema,
  parseBusinessHoursForm,
  rulesChanged,
  serviceSchema,
} from "./schemas";

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

export async function saveServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin("/admin/servicios");
  const values = safeFormValues(formData);

  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { id, ...service } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("services").update(service).eq("id", id)
    : await supabase.from("services").insert(service);

  if (error) {
    console.error("Error al guardar servicio", error.code, error.message);
    return errorState("No se pudo guardar el servicio. Intenta de nuevo.", undefined, values);
  }

  revalidatePath("/admin/servicios");
  revalidatePath("/agendar");
  return {
    status: "success",
    message: id ? `Servicio «${service.name}» actualizado.` : `Servicio «${service.name}» creado.`,
  };
}

export async function createBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin("/admin/citas");
  const values = safeFormValues(formData);

  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { startDate, startTime, endDate, endTime, reason } = parsed.data;
  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = zonedDateTimeToUtc(startDate, startTime, siteConfig.timeZone);
    endsAt = zonedDateTimeToUtc(endDate, endTime, siteConfig.timeZone);
  } catch {
    return errorState("Revisa las fechas.", undefined, values);
  }
  if (endsAt <= startsAt) {
    return errorState(
      "Revisa los campos marcados.",
      { endTime: ["El final debe ser después del inicio"] },
      values,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("blocked_periods").insert({
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason,
  });
  if (error) {
    console.error("Error al bloquear horario", error.code, error.message);
    return errorState(
      error.code === "23514"
        ? "Un bloqueo puede durar máximo 90 días."
        : "No se pudo guardar el bloqueo. Intenta de nuevo.",
      undefined,
      values,
    );
  }

  revalidatePath("/admin/citas");
  return { status: "success", message: "Horario bloqueado." };
}

export async function deleteBlockAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/citas");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("blocked_periods").delete().eq("id", id.data);
  if (error) console.error("Error al quitar bloqueo", error.code, error.message);
  revalidatePath("/admin/citas");
}
