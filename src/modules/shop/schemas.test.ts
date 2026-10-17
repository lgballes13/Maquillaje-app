import { describe, expect, it } from "vitest";
import {
  checkoutSchema,
  cleanSearch,
  detectImageType,
  orderStatusSchema,
  preorderSchema,
  productSchema,
} from "./schemas";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const checkout = {
  items: JSON.stringify([{ productId: A, quantity: 2 }]),
  deliveryMethod: "pickup",
  recipientName: "Ana Pérez",
  phone: "300 123 4567",
  rulesVersion: "3",
  acceptTerms: "on",
};

describe("checkoutSchema", () => {
  it("acepta un pedido para recoger sin dirección", () => {
    const result = checkoutSchema.parse(checkout);
    expect(result.items).toEqual([{ productId: A, quantity: 2 }]);
    expect(result.rulesVersion).toBe(3);
  });

  it("exige dirección y ciudad para el envío", () => {
    const result = checkoutSchema.safeParse({ ...checkout, deliveryMethod: "shipping" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["address", "city"]));
  });

  it("acepta el envío con dirección y ciudad", () => {
    expect(
      checkoutSchema.safeParse({
        ...checkout,
        deliveryMethod: "shipping",
        address: "Calle 10 # 20-30",
        city: "Medellín",
      }).success,
    ).toBe(true);
  });

  it.each([
    ["sin aceptar las condiciones", { acceptTerms: undefined }],
    ["con el carrito vacío", { items: "[]" }],
    ["con un carrito que no es JSON", { items: "nope" }],
    ["con un celular con letras", { phone: "300-abc" }],
    ["con un método de entrega inventado", { deliveryMethod: "dron" }],
    ["con más de 10 unidades", { items: JSON.stringify([{ productId: A, quantity: 11 }]) }],
  ])("rechaza el pedido %s", (_case, change) => {
    expect(checkoutSchema.safeParse({ ...checkout, ...change }).success).toBe(false);
  });

  it("no acepta precios del navegador: los ignora", () => {
    const result = checkoutSchema.parse({
      ...checkout,
      items: JSON.stringify([{ productId: A, quantity: 1, price: 1 }]),
      totalCop: "1",
    });
    expect(result.items).toEqual([{ productId: A, quantity: 1 }]);
    expect(result).not.toHaveProperty("totalCop");
  });
});

describe("cleanSearch", () => {
  it("quita comodines y caracteres de filtros", () => {
    expect(cleanSearch("  lab%ial_*  (rojo), ")).toBe("lab ial rojo");
  });

  it("corta a 60 caracteres y descarta lo que no es texto", () => {
    expect(cleanSearch("a".repeat(100))).toHaveLength(60);
    expect(cleanSearch(["labial"])).toBe("");
  });
});

describe("productSchema", () => {
  const product = {
    name: "Labial mate",
    price_cop: "45000",
    stock: "12",
    sort_order: "0",
    category_id: "",
    is_active: "on",
  };

  it("convierte el formulario en números y deja la categoría vacía como null", () => {
    expect(productSchema.parse(product)).toMatchObject({
      price_cop: 45000,
      stock: 12,
      category_id: null,
      is_active: true,
      allow_preorder: false,
      description: null,
    });
    expect(productSchema.parse({ ...product, allow_preorder: "on" }).allow_preorder).toBe(true);
  });

  it.each([
    ["price_cop", "999", /mínimo 1000/],
    ["stock", "-1", /mínimo 0/],
    ["stock", "2.5", /entero/],
    ["name", "ab", /Mínimo 3/],
  ])("rechaza %s = %s", (field, value, message) => {
    const result = productSchema.safeParse({ ...product, [field]: value });
    expect(result.error?.issues[0]?.message).toMatch(message);
  });
});

describe("detectImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

  it("reconoce JPG, PNG y WebP por sus primeros bytes", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(
      detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))?.ext,
    ).toBe("webp");
  });

  it("rechaza otros archivos aunque se llamen .jpg", () => {
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull(); // PDF
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("preorderSchema", () => {
  const preorder = {
    productId: A,
    quantity: "2",
    deliveryMethod: "pickup",
    recipientName: "Ana Pérez",
    phone: "300 123 4567",
    rulesVersion: "4",
    acceptTerms: "on",
  };

  it("acepta una reserva para recoger y convierte las unidades en número", () => {
    expect(preorderSchema.parse(preorder)).toMatchObject({ productId: A, quantity: 2 });
  });

  it("exige dirección para el envío, unidades válidas y aceptar las condiciones", () => {
    const shipping = preorderSchema.safeParse({ ...preorder, deliveryMethod: "shipping" });
    expect(shipping.error?.issues.map((issue) => issue.path[0])).toEqual(["address", "city"]);
    expect(preorderSchema.safeParse({ ...preorder, quantity: "11" }).success).toBe(false);
    expect(preorderSchema.safeParse({ ...preorder, quantity: "0" }).success).toBe(false);
    expect(preorderSchema.safeParse({ ...preorder, acceptTerms: undefined }).success).toBe(false);
  });

  it("no acepta montos del navegador: los ignora", () => {
    const result = preorderSchema.parse({ ...preorder, depositCop: "1", priceCop: "1" });
    expect(result).not.toHaveProperty("depositCop");
    expect(result).not.toHaveProperty("priceCop");
  });
});

describe("orderStatusSchema", () => {
  it("acepta «llegó» además de los estados del panel, y nada más", () => {
    expect(orderStatusSchema.parse({ orderId: A, status: "arrived" }).status).toBe("arrived");
    expect(orderStatusSchema.safeParse({ orderId: A, status: "paid" }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ orderId: A, status: "deposit_paid" }).success).toBe(false);
  });
});
