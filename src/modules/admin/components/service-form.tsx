"use client";

import { useActionState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { saveServiceAction } from "../actions";

export interface ServiceFormValues {
  id?: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cop: number;
  sort_order: number;
  is_active: boolean;
}

/** Crea un servicio (sin `service`) o edita uno existente. */
export function ServiceForm({ service }: { service?: ServiceFormValues }) {
  const [state, formAction] = useActionState(saveServiceAction, initialFormState);
  const value = (name: keyof ServiceFormValues) =>
    state.values?.[name] ?? (service?.[name] === null ? "" : String(service?.[name] ?? ""));

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {service?.id ? <input type="hidden" name="id" value={service.id} /> : null}
      <FormField
        name="name"
        label="Nombre"
        required
        maxLength={80}
        defaultValue={value("name")}
        errors={state.fieldErrors?.name}
      />
      <FormField
        name="description"
        label="Descripción (opcional)"
        maxLength={500}
        defaultValue={value("description")}
        errors={state.fieldErrors?.description}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          name="duration_minutes"
          label="Duración (minutos)"
          type="number"
          inputMode="numeric"
          min={15}
          max={600}
          step={5}
          required
          defaultValue={value("duration_minutes")}
          errors={state.fieldErrors?.duration_minutes}
        />
        <FormField
          name="price_cop"
          label="Precio (pesos)"
          type="number"
          inputMode="numeric"
          min={1000}
          step={1000}
          required
          defaultValue={value("price_cop")}
          errors={state.fieldErrors?.price_cop}
        />
        <FormField
          name="sort_order"
          label="Orden en la lista"
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
          state.values ? state.values.is_active === "on" : (service?.is_active ?? true)
        }
      >
        Visible para agendar
      </CheckboxField>
      <SubmitButton pendingText="Guardando…" className="sm:justify-self-start">
        {service?.id ? "Guardar cambios" : "Crear servicio"}
      </SubmitButton>
    </form>
  );
}
