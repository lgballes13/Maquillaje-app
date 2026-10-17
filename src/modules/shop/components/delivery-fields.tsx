"use client";

import { useId } from "react";
import { FormField } from "@/components/forms/form-field";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/forms";
import { formatCop } from "@/modules/booking/policy";
import { DELIVERY_LABELS, type DeliveryMethod } from "../labels";

/** Forma de entrega, datos de quien recibe y notas: los mismos al comprar y al reservar. */
export function DeliveryFields({
  state,
  delivery,
  onDeliveryChange,
  shippingFeeCop,
  shippingNote,
  defaultName,
  defaultPhone,
}: {
  state: FormState;
  delivery: DeliveryMethod;
  onDeliveryChange: (method: DeliveryMethod) => void;
  shippingFeeCop: number;
  /** Texto extra junto a la tarifa de envío (p. ej., cuándo se paga). */
  shippingNote?: string;
  defaultName: string;
  defaultPhone: string;
}) {
  const notesId = useId();
  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;

  return (
    <fieldset className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <legend className="px-1 text-lg font-semibold">¿Cómo quieres recibirlo?</legend>
      {(["pickup", "shipping"] as const).map((method) => (
        <label
          key={method}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-checked:border-primary"
        >
          <input
            type="radio"
            name="deliveryMethod"
            value={method}
            // No controlado: si React reinicia el formulario tras un error, vuelve a la opción elegida.
            defaultChecked={delivery === method}
            onChange={() => onDeliveryChange(method)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>
            <span className="font-medium">{DELIVERY_LABELS[method]}</span>
            <span className="block text-muted-foreground">
              {method === "pickup"
                ? "Sin costo. Te avisamos cuando esté listo para recoger en el estudio."
                : shippingFeeCop > 0
                  ? `Tarifa fija de ${formatCop(shippingFeeCop)}.${shippingNote ? ` ${shippingNote}` : ""}`
                  : "Envío gratis."}
            </span>
          </span>
        </label>
      ))}

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <FormField
          name="recipientName"
          label="Nombre de quien recibe"
          autoComplete="name"
          required
          maxLength={100}
          defaultValue={value("recipientName", defaultName)}
          errors={state.fieldErrors?.recipientName}
        />
        <FormField
          name="phone"
          label="Celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={20}
          hint="Para avisarte del pedido."
          defaultValue={value("phone", defaultPhone)}
          errors={state.fieldErrors?.phone}
        />
      </div>
      {delivery === "shipping" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="address"
            label="Dirección de envío"
            autoComplete="street-address"
            required
            maxLength={200}
            defaultValue={value("address")}
            errors={state.fieldErrors?.address}
          />
          <FormField
            name="city"
            label="Ciudad"
            autoComplete="address-level2"
            required
            maxLength={80}
            defaultValue={value("city")}
            errors={state.fieldErrors?.city}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={notesId}>Notas del pedido (opcional)</Label>
        <textarea
          id={notesId}
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={value("notes")}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
    </fieldset>
  );
}
