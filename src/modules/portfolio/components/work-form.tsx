"use client";

import { useActionState, useId } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { saveWorkAction } from "../admin-actions";

export interface WorkFormValues {
  id?: string;
  title: string;
  description: string | null;
  category_id: string | null;
  service_id: string | null;
  sort_order: number;
}

type Option = { id: string; name: string };

const selectClass =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Crea un trabajo (sin `work`, pide la autorización) o edita uno existente.
 * La autorización no se cambia después de crearlo.
 */
export function WorkForm({
  work,
  categories,
  services,
  consents,
}: {
  work?: WorkFormValues;
  categories: Option[];
  services: Option[];
  consents?: Option[];
}) {
  const [state, formAction] = useActionState(saveWorkAction, initialFormState);
  const value = (name: keyof WorkFormValues) => state.values?.[name] ?? String(work?.[name] ?? "");
  const ids = { description: useId(), category: useId(), service: useId(), consent: useId() };
  const consentError = state.fieldErrors?.consent_id;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {work?.id ? <input type="hidden" name="id" value={work.id} /> : null}
      {consents ? (
        <div className="grid gap-2">
          <Label htmlFor={ids.consent}>Autorización de la clienta</Label>
          <select
            id={ids.consent}
            name="consent_id"
            required
            defaultValue={state.values?.consent_id ?? ""}
            aria-invalid={Boolean(consentError) || undefined}
            aria-describedby={consentError ? `${ids.consent}-error` : undefined}
            className={selectClass}
          >
            <option value="">Elige la autorización firmada</option>
            {consents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {consentError ? (
            <p id={`${ids.consent}-error`} className="text-sm font-medium text-destructive">
              {consentError.join(" ")}
            </p>
          ) : null}
        </div>
      ) : null}
      <FormField
        name="title"
        label="Título"
        required
        maxLength={80}
        defaultValue={value("title")}
        errors={state.fieldErrors?.title}
      />
      <div className="grid gap-2">
        <Label htmlFor={ids.description}>Descripción (opcional)</Label>
        <textarea
          id={ids.description}
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={value("description")}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={ids.category}>Categoría</Label>
          <select
            id={ids.category}
            name="category_id"
            defaultValue={value("category_id")}
            className={selectClass}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={ids.service}>Servicio para «Agendar este estilo»</Label>
          <select
            id={ids.service}
            name="service_id"
            defaultValue={value("service_id")}
            className={selectClass}
          >
            <option value="">Sin botón de agendar</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <FormField
          name="sort_order"
          label="Orden"
          hint="Los números menores salen primero."
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          required
          defaultValue={value("sort_order") || "0"}
          errors={state.fieldErrors?.sort_order}
        />
      </div>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        {work?.id ? "Guardar cambios" : "Crear trabajo"}
      </SubmitButton>
    </form>
  );
}
