"use client";

import { useEffect } from "react";
import { clearCart } from "../cart";

/** Vacía el carrito del navegador (al volver de un pago aprobado). */
export function ClearCart() {
  useEffect(() => {
    clearCart();
  }, []);
  return null;
}
