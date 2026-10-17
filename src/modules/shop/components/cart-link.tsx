"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cartUnits } from "../cart";
import { useCart } from "./use-cart";

/** Enlace al carrito en el encabezado, con el número de unidades. */
export function CartLink({ className }: { className: string }) {
  const units = cartUnits(useCart());
  return (
    <Link
      href="/carrito"
      className={className}
      aria-label={
        units > 0 ? `Carrito: ${units} ${units === 1 ? "unidad" : "unidades"}` : "Carrito"
      }
      data-testid="cart-link"
    >
      <ShoppingBag aria-hidden="true" className="size-5" />
      {units > 0 ? (
        <span
          aria-hidden="true"
          className="ml-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
        >
          {units}
        </span>
      ) : null}
    </Link>
  );
}
