"use client";

import { useActionState, useId } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { saveProductAction } from "../admin-actions";

export interface ProductFormValues {
  id?: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price_cop: number;
  stock: number;
  sort_order: number;
  is_active: boolean;
}

const selectClass =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Crea un producto (sin `product`) o edita uno existente. */
export function ProductForm({
  product,
  categories,
}: {
  product?: ProductFormValues;
  categories: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(saveProductAction, initialFormState);
  const value = (name: keyof ProductFormValues) =>
    state.values?.[name] ?? String(product?.[name] ?? "");
  const categoryId = useId();
  const descriptionId = useId();

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <FormField
        name="name"
        label="Nombre"
        required
        maxLength={80}
        defaultValue={value("name")}
        errors={state.fieldErrors?.name}
      />
      <div className="grid gap-2">
        <Label htmlFor={descriptionId}>Descripción (opcional)</Label>
        <textarea
          id={descriptionId}
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={value("description")}
          aria-invalid={Boolean(state.fieldErrors?.description) || undefined}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={categoryId}>Categoría</Label>
        <select
          id={categoryId}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          name="price_cop"
          label="Precio con IVA (pesos)"
          type="number"
          inputMode="numeric"
          min={1000}
          step={100}
          required
          defaultValue={value("price_cop")}
          errors={state.fieldErrors?.price_cop}
        />
        <FormField
          name="stock"
          label="Unidades en el estudio"
          hint="Las vendidas se descuentan solas al pagarse."
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          required
          defaultValue={value("stock") || "0"}
          errors={state.fieldErrors?.stock}
        />
        <FormField
          name="sort_order"
          label="Orden en la tienda"
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
          state.values ? state.values.is_active === "on" : (product?.is_active ?? true)
        }
      >
        Visible en la tienda
      </CheckboxField>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        {product?.id ? "Guardar cambios" : "Crear producto"}
      </SubmitButton>
    </form>
  );
}
