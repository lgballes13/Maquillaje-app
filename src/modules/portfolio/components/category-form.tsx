"use client";

import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { savePortfolioCategoryAction } from "../admin-actions";

export interface PortfolioCategoryValues {
  id?: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** Crea una categoría del portafolio (sin `category`) o edita una existente. */
export function PortfolioCategoryForm({ category }: { category?: PortfolioCategoryValues }) {
  const [state, formAction] = useActionState(savePortfolioCategoryAction, initialFormState);
  const value = (name: keyof PortfolioCategoryValues) =>
    state.values?.[name] ?? String(category?.[name] ?? "");

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {category?.id ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="name"
          label="Nombre de la categoría"
          required
          maxLength={40}
          defaultValue={value("name")}
          errors={state.fieldErrors?.name}
        />
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
      <CheckboxField
        name="is_active"
        defaultChecked={
          state.values ? state.values.is_active === "on" : (category?.is_active ?? true)
        }
      >
        Visible en el portafolio
      </CheckboxField>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        {category?.id ? "Guardar categoría" : "Crear categoría"}
      </SubmitButton>
    </form>
  );
}
