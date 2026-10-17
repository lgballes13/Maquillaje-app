"use client";

import { useActionState, useId, useState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { formatCop } from "@/modules/booking/policy";
import { createPreorderAction } from "../actions";
import { preorderDeposit, preorderTerms, type DeliveryMethod } from "../labels";
import { MAX_UNITS_PER_PRODUCT } from "../schemas";
import { DeliveryFields } from "./delivery-fields";

export interface PreorderRules {
  version: number;
  depositPercent: number;
  deliveryDays: number;
  balanceDays: number;
  creditValidityDays: number;
  holdMinutes: number;
  shippingFeeCop: number;
}

/**
 * Formulario de reserva. Los montos que ve la clienta son una vista previa;
 * create_preorder los vuelve a calcular con los precios y reglas vigentes.
 */
export function PreorderForm({
  productId,
  priceCop,
  rules,
  creditCop,
  defaultName,
  defaultPhone,
}: {
  productId: string;
  priceCop: number;
  rules: PreorderRules;
  creditCop: number;
  defaultName: string;
  defaultPhone: string;
}) {
  const [state, formAction] = useActionState(createPreorderAction, initialFormState);
  const [quantity, setQuantity] = useState(Number(state.values?.quantity ?? 1) || 1);
  const [delivery, setDelivery] = useState<DeliveryMethod>(
    state.values?.deliveryMethod === "shipping" ? "shipping" : "pickup",
  );
  const quantityId = useId();

  const subtotal = priceCop * quantity;
  const shipping = delivery === "shipping" ? rules.shippingFeeCop : 0;
  const deposit = preorderDeposit(subtotal, rules.depositPercent);
  const credit = Math.min(creditCop, deposit);
  const payNow = deposit - credit;
  const balance = subtotal + shipping - deposit;

  return (
    <form action={formAction} className="mt-6 grid gap-6" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rulesVersion" value={rules.version} />

      <div className="grid gap-2 rounded-xl border border-border bg-card p-5">
        <Label htmlFor={quantityId}>Unidades</Label>
        <select
          id={quantityId}
          name="quantity"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="min-h-11 w-24 rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {Array.from({ length: MAX_UNITS_PER_PRODUCT }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <DeliveryFields
        state={state}
        delivery={delivery}
        onDeliveryChange={setDelivery}
        shippingFeeCop={rules.shippingFeeCop}
        shippingNote="Se paga con el saldo, cuando llegue."
        defaultName={defaultName}
        defaultPhone={defaultPhone}
      />

      <section
        aria-labelledby="titulo-total"
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-total" className="text-lg font-semibold">
          Lo que pagas
        </h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt>Productos</dt>
            <dd data-testid="subtotal">{formatCop(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Envío</dt>
            <dd data-testid="shipping">{shipping > 0 ? formatCop(shipping) : "Sin costo"}</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-border pt-2 font-semibold">
            <dt>Total (IVA incluido)</dt>
            <dd data-testid="total">{formatCop(subtotal + shipping)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Anticipo ({rules.depositPercent} %)</dt>
            <dd data-testid="deposit">{formatCop(deposit)}</dd>
          </div>
          {credit > 0 ? (
            <div className="flex justify-between gap-2">
              <dt>Tu saldo a favor</dt>
              <dd data-testid="credit-applied">−{formatCop(credit)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-2 text-base font-semibold">
            <dt>Pagas ahora</dt>
            <dd data-testid="to-pay">{formatCop(payNow)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Pagas cuando llegue</dt>
            <dd data-testid="balance">{formatCop(balance)}</dd>
          </div>
        </dl>

        <h3 className="mt-5 font-semibold">Antes de reservar</h3>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm" data-testid="preorder-terms">
          {preorderTerms(rules).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <div className="mt-4 grid gap-4">
          <FormMessage state={state} />
          <CheckboxField
            name="acceptTerms"
            required
            defaultChecked={state.values?.acceptTerms === "on"}
            errors={state.fieldErrors?.acceptTerms}
          >
            Revisé los montos y acepto las condiciones de la preventa y de retracto.
          </CheckboxField>
          <SubmitButton pendingText="Creando tu reserva…" className="w-full sm:w-auto">
            {payNow > 0
              ? "Continuar al pago del anticipo"
              : credit > 0
                ? "Reservar con mi saldo"
                : "Reservar"}
          </SubmitButton>
        </div>
      </section>
    </form>
  );
}
