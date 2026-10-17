"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorState, safeFormValues, zodFieldErrors, type FormState } from "@/lib/forms";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";
import { detectImageType, MAX_IMAGE_BYTES } from "@/modules/shop/schemas";
import { KNOWN_PORTFOLIO_ERRORS, portfolioErrorMessage } from "./labels";
import { CONSENT_BUCKET, PORTFOLIO_BUCKET } from "./queries";
import {
  consentSchema,
  detectDocumentType,
  MAX_DOCUMENT_BYTES,
  MAX_WORK_PHOTOS,
  portfolioCategorySchema,
  publishSchema,
  revokeConsentSchema,
  workImageSchema,
  workSchema,
} from "./schemas";

/*
 * Acciones del panel para el portafolio. Igual que el resto del panel:
 * requireAdmin() revisa rol + 2FA y las reglas RLS lo vuelven a revisar.
 * Que un trabajo solo se publique con autorización vigente lo hace cumplir la
 * base de datos (trigger), no solo esta capa.
 */

const ADMIN_PATH = "/admin/portafolio";

function revalidatePortfolio(workId?: string) {
  revalidatePath(ADMIN_PATH);
  revalidatePath("/portafolio");
  if (workId) revalidatePath(`/portafolio/${workId}`);
}

export async function savePortfolioCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin(ADMIN_PATH);
  const values = safeFormValues(formData);
  const parsed = portfolioCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { id, ...category } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("portfolio_categories").update(category).eq("id", id)
    : await supabase.from("portfolio_categories").insert(category);
  if (error) {
    if (error.code === "23505") {
      return errorState("Ya existe una categoría con ese nombre.", undefined, values);
    }
    console.error("Error al guardar categoría del portafolio", error.code, error.message);
    return errorState("No se pudo guardar la categoría. Intenta de nuevo.", undefined, values);
  }

  revalidatePortfolio();
  return {
    status: "success",
    message: id
      ? `Categoría «${category.name}» actualizada.`
      : `Categoría «${category.name}» creada.`,
  };
}

/**
 * Registra la autorización firmada: sube el formato (foto o PDF) al bucket
 * PRIVADO «autorizaciones» y guarda nombre y fecha. El tipo real del archivo
 * se revisa por sus primeros bytes y el nombre lo pone el servidor.
 */
export async function saveConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin(ADMIN_PATH);
  const values = safeFormValues(formData);
  const parsed = consentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return errorState(
      "Sube el formato firmado.",
      { document: ["Sube la foto o el PDF del formato firmado"] },
      values,
    );
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return errorState("El archivo pesa más de 5 MB.", { document: ["Máximo 5 MB"] }, values);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectDocumentType(bytes);
  if (!type) {
    return errorState(
      "Ese archivo no es una foto (JPG, PNG o WebP) ni un PDF.",
      { document: ["Usa una foto JPG, PNG o WebP, o un PDF"] },
      values,
    );
  }

  if (!(await consumeRateLimit("upload:user", admin.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const path = `${randomUUID()}.${type.ext}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(CONSENT_BUCKET)
    .upload(path, bytes, { contentType: type.contentType, upsert: false });
  if (uploadError) {
    console.error("Error al subir el formato", uploadError.message);
    return errorState("No se pudo subir el formato. Intenta de nuevo.", undefined, values);
  }

  const { clientName, signedOn, notes } = parsed.data;
  const { error } = await supabase.from("portfolio_consents").insert({
    client_name: clientName,
    signed_on: signedOn,
    notes,
    document_path: path,
  });
  if (error) {
    console.error("Error al guardar la autorización", error.code, error.message);
    // El archivo queda huérfano en el bucket privado; solo la admin lo puede ver.
    return errorState("No se pudo guardar la autorización. Intenta de nuevo.", undefined, values);
  }

  revalidatePath(ADMIN_PATH);
  return { status: "success", message: `Autorización de ${clientName} registrada.` };
}

/**
 * La clienta retiró la autorización: la base oculta sus trabajos y aquí se
 * borran sus fotos del bucket público (Ley 1581: dejar de usar sus datos).
 * La autorización y los trabajos quedan como historial.
 */
export async function revokeConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin(ADMIN_PATH);
  const values = safeFormValues(formData);
  const parsed = revokeConsentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { consentId, reason } = parsed.data;
  const supabase = await createClient();
  const { data: consent, error } = await supabase
    .from("portfolio_consents")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("id", consentId)
    .is("revoked_at", null)
    .select("id, client_name")
    .maybeSingle();
  if (error || !consent) {
    if (error && !KNOWN_PORTFOLIO_ERRORS.has(error.message)) {
      console.error("Error al retirar la autorización", error.code, error.message);
    }
    return errorState(
      portfolioErrorMessage(error?.message ?? "consent_revoked"),
      undefined,
      values,
    );
  }

  const { data: works } = await supabase
    .from("portfolio_works")
    .select("id")
    .eq("consent_id", consentId);
  const workIds = (works ?? []).map((work) => work.id);
  if (workIds.length) {
    const { data: images, error: imagesError } = await supabase
      .from("portfolio_images")
      .delete()
      .in("work_id", workIds)
      .select("storage_path");
    if (imagesError) console.error("Error al quitar fotos", imagesError.code, imagesError.message);
    const paths = (images ?? []).map((image) => image.storage_path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(PORTFOLIO_BUCKET).remove(paths);
      if (storageError) console.error("Error al borrar archivos de fotos", storageError.message);
    }
  }

  revalidatePortfolio();
  for (const id of workIds) revalidatePath(`/portafolio/${id}`);
  return {
    status: "success",
    message: `Autorización de ${consent.client_name} retirada: sus trabajos se ocultaron y sus fotos se borraron.`,
  };
}

/** Crea un trabajo (siempre oculto) o edita uno existente. */
export async function saveWorkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin(ADMIN_PATH);
  const values = safeFormValues(formData);
  const parsed = workSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const { id, consent_id, ...work } = parsed.data;
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("portfolio_works").update(work).eq("id", id);
    if (error) {
      console.error("Error al guardar el trabajo", error.code, error.message);
      return errorState("No se pudo guardar el trabajo. Intenta de nuevo.", undefined, values);
    }
    revalidatePortfolio(id);
    return { status: "success", message: `Trabajo «${work.title}» actualizado.` };
  }

  if (!consent_id) {
    return errorState(
      "Elige la autorización firmada de la clienta.",
      { consent_id: ["Elige la autorización"] },
      values,
    );
  }
  const { data: consent } = await supabase
    .from("portfolio_consents")
    .select("id")
    .eq("id", consent_id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!consent) {
    return errorState(
      "Esa autorización no existe o fue retirada.",
      { consent_id: ["Elige una autorización vigente"] },
      values,
    );
  }

  const { error } = await supabase.from("portfolio_works").insert({ ...work, consent_id });
  if (error) {
    console.error("Error al crear el trabajo", error.code, error.message);
    return errorState("No se pudo crear el trabajo. Intenta de nuevo.", undefined, values);
  }
  revalidatePortfolio();
  return {
    status: "success",
    message: `Trabajo «${work.title}» creado. Súbele fotos y luego publícalo.`,
  };
}

/** Publica u oculta un trabajo. La base exige autorización vigente y foto de «después». */
export async function setWorkPublishedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin(ADMIN_PATH);
  const parsed = publishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Acción inválida.");

  const { workId, publish } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_works")
    .update({ is_published: publish === "yes" })
    .eq("id", workId);
  if (error) {
    if (!KNOWN_PORTFOLIO_ERRORS.has(error.message)) {
      console.error("Error al publicar el trabajo", error.code, error.message);
    }
    return errorState(portfolioErrorMessage(error.message));
  }
  revalidatePortfolio(workId);
  return {
    status: "success",
    message: publish === "yes" ? "Trabajo publicado." : "Trabajo oculto.",
  };
}

/** Sube una foto de antes o de después al bucket público «portafolio». */
export async function uploadWorkImageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin(ADMIN_PATH);
  const values = safeFormValues(formData);
  const parsed = workImageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return errorState("Revisa los campos marcados.", zodFieldErrors(parsed.error), values);
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Elige una foto.", { image: ["Elige una foto"] }, values);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return errorState("La foto pesa más de 5 MB.", { image: ["Máximo 5 MB"] }, values);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return errorState(
      "Ese archivo no es una foto JPG, PNG o WebP.",
      { image: ["Usa una foto JPG, PNG o WebP"] },
      values,
    );
  }

  if (!(await consumeRateLimit("upload:user", admin.id))) {
    return errorState(RATE_LIMIT_MESSAGE, undefined, values);
  }

  const { workId, kind, altText } = parsed.data;
  const supabase = await createClient();
  // Solo trabajos con autorización vigente reciben fotos.
  const { data: work } = await supabase
    .from("portfolio_works")
    .select("id, portfolio_consents(revoked_at)")
    .eq("id", workId)
    .maybeSingle();
  if (!work || work.portfolio_consents?.revoked_at) {
    return errorState(portfolioErrorMessage("consent_required"), undefined, values);
  }
  const { count } = await supabase
    .from("portfolio_images")
    .select("id", { count: "exact", head: true })
    .eq("work_id", workId);
  if ((count ?? 0) >= MAX_WORK_PHOTOS) {
    return errorState(
      `Cada trabajo puede tener máximo ${MAX_WORK_PHOTOS} fotos.`,
      undefined,
      values,
    );
  }

  const path = `${workId}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, bytes, { contentType: type.contentType, upsert: false });
  if (uploadError) {
    console.error("Error al subir foto del portafolio", uploadError.message);
    return errorState("No se pudo subir la foto. Intenta de nuevo.", undefined, values);
  }

  const { error } = await supabase.from("portfolio_images").insert({
    work_id: workId,
    kind,
    storage_path: path,
    alt_text: altText,
    sort_order: count ?? 0,
  });
  if (error) {
    console.error("Error al guardar foto del portafolio", error.code, error.message);
    await supabase.storage.from(PORTFOLIO_BUCKET).remove([path]);
    return errorState("No se pudo guardar la foto. Intenta de nuevo.", undefined, values);
  }

  revalidatePortfolio(workId);
  return { status: "success", message: "Foto agregada." };
}

export async function deleteWorkImageAction(formData: FormData): Promise<void> {
  await requireAdmin(ADMIN_PATH);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { data: image, error } = await supabase
    .from("portfolio_images")
    .delete()
    .eq("id", id.data)
    .select("work_id, storage_path")
    .maybeSingle();
  if (error || !image) {
    if (error) console.error("Error al quitar foto del portafolio", error.code, error.message);
    return;
  }
  const { error: storageError } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .remove([image.storage_path]);
  if (storageError) console.error("Error al borrar el archivo de la foto", storageError.message);
  revalidatePortfolio(image.work_id);
}
