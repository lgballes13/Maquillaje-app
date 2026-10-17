import { cartSchema, MAX_CART_LINES, MAX_UNITS_PER_PRODUCT, type CartItem } from "./schemas";

/*
 * Carrito guardado en el navegador (localStorage). Solo guarda QUÉ productos y
 * CUÁNTAS unidades: el precio, el stock y el total siempre los calcula el
 * servidor. Si alguien edita el localStorage, lo peor que logra es un carrito
 * inválido, que se descarta.
 */

export const CART_STORAGE_KEY = "tienda:carrito:v1";
export const CART_EVENT = "cart-change";

/** Lee el carrito desde un texto guardado; si no es válido, carrito vacío. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Suma unidades de un producto (máximo 10 por producto y 20 productos). */
export function addItem(items: CartItem[], productId: string, quantity = 1): CartItem[] {
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    return setItemQuantity(items, productId, existing.quantity + quantity);
  }
  if (items.length >= MAX_CART_LINES) return items;
  return [...items, { productId, quantity: clampQuantity(quantity) }];
}

/** Cambia las unidades de un producto; 0 o menos lo quita. */
export function setItemQuantity(
  items: CartItem[],
  productId: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) return removeItem(items, productId);
  return items.map((item) =>
    item.productId === productId ? { ...item, quantity: clampQuantity(quantity) } : item,
  );
}

export function removeItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}

export function cartUnits(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function clampQuantity(quantity: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_UNITS_PER_PRODUCT);
}

// ---------------------------------------------------------------------------
// Acceso al localStorage (solo en el navegador)
// ---------------------------------------------------------------------------
const EMPTY: CartItem[] = [];
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    // Modo privado o almacenamiento bloqueado: el carrito vive solo en memoria.
    return cachedRaw;
  }
}

/** Carrito actual. Devuelve la misma referencia si no cambió (useSyncExternalStore). */
export function getCart(): CartItem[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parseCart(raw);
  }
  return cachedItems;
}

export function getServerCart(): CartItem[] {
  return EMPTY;
}

export function saveCart(items: CartItem[]): void {
  const raw = JSON.stringify(items);
  cachedRaw = raw;
  cachedItems = items;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, raw);
  } catch {
    // Sin almacenamiento: queda en memoria hasta recargar.
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function updateCart(change: (items: CartItem[]) => CartItem[]): void {
  saveCart(change(getCart()));
}

export function clearCart(): void {
  saveCart([]);
}

/** Avisa cuando cambia el carrito (en esta pestaña o en otra). */
export function subscribeCart(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY) onChange();
  };
  window.addEventListener(CART_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CART_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
