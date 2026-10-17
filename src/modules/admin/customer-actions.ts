"use server";

import { revalidatePath } from "next/cache";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";
import { customerNoteSchema } from "./customers";

/** Guarda la nota interna de una clienta (ella nunca la ve; queda en la auditoría). */
export async function saveCustomerNoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("/admin/clientas");
  const values = safeFormValues(formData);
  const parsed = customerNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa la nota.", zodFieldErrors(parsed.error), values);
  }

  const { customerId, note } = parsed.data;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("customer_notes")
    .select("customer_id")
    .eq("customer_id", customerId)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("customer_notes").update({ note }).eq("customer_id", customerId)
    : await supabase.from("customer_notes").insert({ customer_id: customerId, note });

  if (error) {
    console.error("Error al guardar la nota", error.code, error.message);
    return errorState("No se pudo guardar la nota. Intenta de nuevo.", undefined, values);
  }

  revalidatePath(`/admin/clientas/${customerId}`);
  return { status: "success", message: "Nota guardada.", values: { note } };
}
