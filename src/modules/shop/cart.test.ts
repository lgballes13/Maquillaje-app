import { describe, expect, it } from "vitest";
import { addItem, cartUnits, parseCart, removeItem, setItemQuantity } from "./cart";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("parseCart", () => {
  it("lee un carrito válido", () => {
    expect(parseCart(JSON.stringify([{ productId: A, quantity: 2 }]))).toEqual([
      { productId: A, quantity: 2 },
    ]);
  });

  it.each([
    ["vacío", null],
    ["texto que no es JSON", "{no es json"],
    ["un objeto en vez de una lista", JSON.stringify({ productId: A, quantity: 1 })],
    ["una cantidad con decimales", JSON.stringify([{ productId: A, quantity: 1.5 }])],
    ["más de 10 unidades", JSON.stringify([{ productId: A, quantity: 11 }])],
    ["un id que no es UUID", JSON.stringify([{ productId: "1 or 1=1", quantity: 1 }])],
    [
      "un producto repetido",
      JSON.stringify([
        { productId: A, quantity: 1 },
        { productId: A, quantity: 2 },
      ]),
    ],
  ])("descarta un carrito inválido: %s", (_case, raw) => {
    expect(parseCart(raw)).toEqual([]);
  });
});

describe("cambios del carrito", () => {
  it("agrega un producto nuevo y suma unidades al que ya estaba", () => {
    let items = addItem([], A, 2);
    items = addItem(items, B);
    items = addItem(items, A, 3);
    expect(items).toEqual([
      { productId: A, quantity: 5 },
      { productId: B, quantity: 1 },
    ]);
    expect(cartUnits(items)).toBe(6);
  });

  it("nunca pasa de 10 unidades por producto", () => {
    expect(addItem([{ productId: A, quantity: 9 }], A, 5)).toEqual([
      { productId: A, quantity: 10 },
    ]);
    expect(setItemQuantity([{ productId: A, quantity: 1 }], A, 50)).toEqual([
      { productId: A, quantity: 10 },
    ]);
  });

  it("poner 0 unidades quita el producto", () => {
    expect(setItemQuantity([{ productId: A, quantity: 3 }], A, 0)).toEqual([]);
  });

  it("quita un producto", () => {
    expect(
      removeItem(
        [
          { productId: A, quantity: 1 },
          { productId: B, quantity: 1 },
        ],
        A,
      ),
    ).toEqual([{ productId: B, quantity: 1 }]);
  });
});
