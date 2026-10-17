"use client";

import { useSyncExternalStore } from "react";
import { getCart, getServerCart, subscribeCart } from "../cart";

/** Carrito del navegador; en el servidor (y en el primer render) está vacío. */
export function useCart() {
  return useSyncExternalStore(subscribeCart, getCart, getServerCart);
}

const noop = () => () => {};

/** true después de hidratar: evita mostrar "carrito vacío" antes de leer el localStorage. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
