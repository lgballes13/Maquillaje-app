"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addItem, updateCart } from "../cart";
import { MAX_UNITS_PER_PRODUCT } from "../schemas";
import { useCart } from "./use-cart";

/** Selector de unidades + «Agregar al carrito». El stock real lo revisa el servidor al pagar. */
export function AddToCart({ productId, available }: { productId: string; available: number }) {
  const items = useCart();
  const inCart = items.find((item) => item.productId === productId)?.quantity ?? 0;
  const max = Math.max(Math.min(available, MAX_UNITS_PER_PRODUCT) - inCart, 0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const selectId = useId();

  if (available <= 0) {
    return (
      <p className="font-medium text-muted-foreground" data-testid="out-of-stock">
        Agotado por ahora.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {max > 0 ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            updateCart((current) => addItem(current, productId, Math.min(quantity, max)));
            setQuantity(1);
            setAdded(true);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={selectId}>Unidades</Label>
            <select
              id={selectId}
              value={Math.min(quantity, max)}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="min-h-11 rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="lg">
            Agregar al carrito
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ya tienes en el carrito todas las unidades que puedes llevar de este producto.
        </p>
      )}
      <p role="status" className="text-sm" data-testid="add-to-cart-status">
        {added || inCart > 0 ? (
          <>
            Tienes {inCart} {inCart === 1 ? "unidad" : "unidades"} en el carrito.{" "}
            <Link
              href="/carrito"
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            >
              Ver carrito
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
