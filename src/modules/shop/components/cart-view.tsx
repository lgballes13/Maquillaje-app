"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { formatCop } from "@/modules/booking/policy";
import { createOrderAction, quoteCartAction } from "../actions";
import { removeItem, setItemQuantity, updateCart } from "../cart";
import { UNOPTIMIZED_IMAGES } from "../images";
import { DELIVERY_LABELS, purchaseTerms, type DeliveryMethod } from "../labels";
import type { CartQuote } from "../queries";
import { MAX_UNITS_PER_PRODUCT } from "../schemas";
import { useCart, useHydrated } from "./use-cart";

/**
 * Carrito y datos de entrega. Los precios, el stock y el envío vienen del
 * servidor (quoteCartAction) cada vez que cambia el carrito; al pagar,
 * create_order los vuelve a calcular.
 */
export function CartView({
  signedIn,
  defaultName,
  defaultPhone,
}: {
  signedIn: boolean;
  defaultName: string;
  defaultPhone: string;
}) {
  const items = useCart();
  const hydrated = useHydrated();
  const key = JSON.stringify(items);
  const [loaded, setLoaded] = useState<{ key: string; quote: CartQuote | null } | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    let active = true;
    quoteCartAction(items).then((quote) => {
      if (active) setLoaded({ key, quote });
    });
    return () => {
      active = false;
    };
  }, [items, key]);

  if (!hydrated) {
    return <p className="mt-6 text-muted-foreground">Cargando tu carrito…</p>;
  }
  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <p data-testid="cart-empty">Tu carrito está vacío.</p>
        <Link href="/tienda" className={buttonVariants({ className: "mt-4" })}>
          Ir a la tienda
        </Link>
      </div>
    );
  }

  const quote = loaded?.key === key ? loaded.quote : (loaded?.quote ?? null);
  const loading = loaded?.key !== key;
  if (!quote) {
    return loading ? (
      <p className="mt-6 text-muted-foreground">Calculando precios…</p>
    ) : (
      <p role="alert" className="mt-6 font-medium text-destructive">
        No pudimos cargar los precios. Recarga la página.
      </p>
    );
  }

  return (
    <CartContents
      quote={quote}
      loading={loading}
      signedIn={signedIn}
      defaultName={defaultName}
      defaultPhone={defaultPhone}
      itemsJson={key}
    />
  );
}

function CartContents({
  quote,
  loading,
  signedIn,
  defaultName,
  defaultPhone,
  itemsJson,
}: {
  quote: CartQuote;
  loading: boolean;
  signedIn: boolean;
  defaultName: string;
  defaultPhone: string;
  itemsJson: string;
}) {
  const [state, formAction] = useActionState(createOrderAction, initialFormState);
  const [delivery, setDelivery] = useState<DeliveryMethod>(
    state.values?.deliveryMethod === "shipping" ? "shipping" : "pickup",
  );
  const notesId = useId();
  const hasProblems = quote.missing.length > 0 || quote.lines.some((line) => line.problem);
  const shipping = delivery === "shipping" ? quote.shippingFeeCop : 0;
  const total = quote.subtotalCop + shipping;
  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;

  return (
    <div className="mt-6 grid gap-6">
      <section
        aria-labelledby="titulo-productos"
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 id="titulo-productos" className="text-lg font-semibold">
          Productos
        </h2>
        {quote.missing.length > 0 ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {quote.missing.length === 1
              ? "Un producto de tu carrito ya no está disponible."
              : `${quote.missing.length} productos de tu carrito ya no están disponibles.`}{" "}
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
              onClick={() =>
                updateCart((current) =>
                  current.filter((item) => !quote.missing.includes(item.productId)),
                )
              }
            >
              Quitarlos del carrito
            </button>
          </div>
        ) : null}
        <ul className="mt-3 grid gap-4" aria-label="Productos del carrito">
          {quote.lines.map((line) => (
            <li key={line.productId} className="flex gap-3" data-testid="cart-line">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {line.image ? (
                  <Image
                    src={line.image.url}
                    alt={line.image.alt}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized={UNOPTIMIZED_IMAGES}
                  />
                ) : null}
              </div>
              <div className="grid flex-1 gap-1">
                <Link
                  href={`/tienda/${line.productId}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {line.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {formatCop(line.unitPriceCop)} c/u
                </span>
                {line.problem ? (
                  <span role="alert" className="text-sm font-medium text-destructive">
                    {line.problem === "unavailable"
                      ? "Agotado: quítalo del carrito para continuar."
                      : `Solo quedan ${line.available} unidades: baja la cantidad para continuar.`}
                  </span>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <QuantitySelect
                    name={line.name}
                    quantity={line.quantity}
                    max={Math.max(Math.min(line.available, MAX_UNITS_PER_PRODUCT), line.quantity)}
                    onChange={(quantity) =>
                      updateCart((current) => setItemQuantity(current, line.productId, quantity))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateCart((current) => removeItem(current, line.productId))}
                  >
                    Quitar<span className="sr-only"> {line.name}</span>
                  </Button>
                </div>
              </div>
              <span className="font-medium" data-testid="line-total">
                {formatCop(line.lineTotalCop)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form action={formAction} className="grid gap-6" noValidate aria-busy={loading}>
        <input type="hidden" name="items" value={itemsJson} />
        <input type="hidden" name="rulesVersion" value={quote.rulesVersion} />

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
                onChange={() => setDelivery(method)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span>
                <span className="font-medium">{DELIVERY_LABELS[method]}</span>
                <span className="block text-muted-foreground">
                  {method === "pickup"
                    ? "Sin costo. Te avisamos cuando esté listo para recoger en el estudio."
                    : quote.shippingFeeCop > 0
                      ? `Tarifa fija de ${formatCop(quote.shippingFeeCop)}.`
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

        <section
          aria-labelledby="titulo-total"
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2 id="titulo-total" className="text-lg font-semibold">
            Total a pagar
          </h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt>Productos</dt>
              <dd data-testid="subtotal">{formatCop(quote.subtotalCop)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Envío</dt>
              <dd data-testid="shipping">{shipping > 0 ? formatCop(shipping) : "Sin costo"}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-border pt-2 text-base font-semibold">
              <dt>Total (IVA incluido)</dt>
              <dd data-testid="total">{formatCop(total)}</dd>
            </div>
          </dl>

          <h3 className="mt-5 font-semibold">Antes de pagar</h3>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm" data-testid="purchase-terms">
            {purchaseTerms(quote.holdMinutes).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <div className="mt-4 grid gap-4">
            <FormMessage state={state} />
            {signedIn ? (
              <>
                <CheckboxField
                  name="acceptTerms"
                  required
                  defaultChecked={state.values?.acceptTerms === "on"}
                  errors={state.fieldErrors?.acceptTerms}
                >
                  Revisé el total y acepto las condiciones de compra y de retracto.
                </CheckboxField>
                {hasProblems ? (
                  <p className="text-sm font-medium text-destructive">
                    Corrige los productos marcados para continuar.
                  </p>
                ) : null}
                {hasProblems || loading ? (
                  <Button type="button" size="lg" disabled className="w-full sm:w-auto">
                    {loading ? "Actualizando precios…" : "Continuar al pago"}
                  </Button>
                ) : (
                  <SubmitButton pendingText="Apartando tus productos…" className="w-full sm:w-auto">
                    Continuar al pago
                  </SubmitButton>
                )}
              </>
            ) : (
              <p className="text-sm">
                Para pagar necesitas una cuenta.{" "}
                <Link
                  href="/ingresar?next=/carrito"
                  className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
                >
                  Ingresa o crea tu cuenta
                </Link>{" "}
                y tu carrito te espera aquí.
              </p>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}

function QuantitySelect({
  name,
  quantity,
  max,
  onChange,
}: {
  name: string;
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
}) {
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <Label htmlFor={id} className="text-sm">
        Unidades<span className="sr-only"> de {name}</span>
      </Label>
      <select
        id={id}
        value={quantity}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </span>
  );
}
