/*
 * Límites del carrito, los mismos de la base de datos (CHECK y create_order).
 * Viven aparte de `schemas.ts` para que el carrito del navegador no cargue Zod.
 */

export const MAX_UNITS_PER_PRODUCT = 10;
export const MAX_CART_LINES = 20;
