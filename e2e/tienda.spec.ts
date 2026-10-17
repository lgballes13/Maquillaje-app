import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import { expectNoA11yViolations } from "./helpers/booking";
import { waitForEmail } from "./helpers/mailpit";
import {
  createTestProduct,
  createTestUser,
  insertPaidOrder,
  productStock,
  shippingFee,
} from "./helpers/supabase";
import { signedWompiEvent } from "./helpers/wompi";

/*
 * Tienda: catálogo, carrito, pedido, pago y panel. Las pruebas que compran
 * crean su propio producto (createTestProduct) para no pelear por el stock
 * con otras pruebas que corren en paralelo contra la misma base.
 */

// PNG de 1 × 1 píxel para subir como foto.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function digits(text: string | null): string {
  return (text ?? "").replace(/\D/g, "");
}

async function addToCart(page: Page, productId: string, units = 1) {
  await page.goto(`/tienda/${productId}`);
  if (units > 1) await page.getByLabel("Unidades").selectOption(String(units));
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByTestId("add-to-cart-status")).toContainText("en el carrito");
}

async function readCheckout(page: Page) {
  const form = page.getByTestId("wompi-form");
  const field = (name: string) => form.locator(`input[name="${name}"]`).inputValue();
  return {
    reference: await field("reference"),
    amountInCents: Number(await field("amount-in-cents")),
    redirectUrl: await field("redirect-url"),
  };
}

test.describe("Catálogo", () => {
  test("se busca por nombre, se filtra por categoría y se ve el detalle", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Tienda" })
      .click();
    await expect(page.getByRole("heading", { name: "Tienda", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByLabel("Buscar productos").fill("labial");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/q=labial/);
    const results = page.getByRole("list", { name: "Productos" });
    await expect(results.getByRole("link", { name: /Labial líquido mate/ })).toBeVisible();
    await expect(results.getByRole("link", { name: /Set de brochas/ })).toHaveCount(0);

    await page.getByLabel("Buscar productos").fill("no-existe-este-producto");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByTestId("no-results")).toBeVisible();

    await page.goto("/tienda");
    await page
      .getByRole("navigation", { name: "Categorías" })
      .getByRole("link", { name: "Brochas" })
      .click();
    await expect(page.getByRole("link", { name: "Brochas", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(results.getByRole("link", { name: /Set de brochas/ })).toBeVisible();
    await expect(results.getByRole("link", { name: /Labial líquido mate/ })).toHaveCount(0);

    await results.getByRole("link", { name: /Set de brochas/ }).click();
    await expect(page.getByRole("heading", { name: "Set de brochas" })).toBeVisible();
    expect(digits(await page.getByTestId("product-price").textContent())).toBe("120000");
    await expect(page.getByText("IVA incluido")).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe("Comprar", () => {
  test("para recoger: el carrito espera el ingreso, aparta el stock y se paga con Wompi", async ({
    page,
    request,
  }) => {
    const product = await createTestProduct({
      name: "Labial de prueba",
      priceCop: 50_000,
      stock: 3,
    });
    const user = await createTestUser({ name: "Clienta Compra" });

    // Sin sesión se arma el carrito.
    await addToCart(page, product.id, 2);
    await expect(page.getByTestId("cart-link")).toHaveAccessibleName("Carrito: 2 unidades");
    await page.getByTestId("cart-link").click();
    await expect(page.getByTestId("cart-line")).toContainText(product.name);
    expect(digits(await page.getByTestId("total").textContent())).toBe("100000");
    await expect(page.getByTestId("purchase-terms")).toContainText("retracto");
    await expectNoA11yViolations(page);

    // Para pagar pide ingresar y vuelve al carrito con los productos.
    await page.getByRole("link", { name: "Ingresa o crea tu cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/carrito$/);
    await expect(page.getByTestId("cart-line")).toContainText(product.name);
    await expect(page.getByLabel("Nombre de quien recibe")).toHaveValue("Clienta Compra");

    // Sin aceptar las condiciones no deja continuar.
    await page.getByLabel("Celular").fill("300 123 4567");
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(
      page.getByText("Debes aceptar las condiciones de compra para continuar"),
    ).toBeVisible();

    await page.getByLabel(/acepto las condiciones de compra/).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");
    await expect(page.getByTestId("order-delivery")).toHaveText("Recoger en el estudio");
    expect(digits(await page.getByTestId("order-total").textContent())).toBe("100000");
    await expectNoA11yViolations(page);

    // El pago va a Wompi con referencia de pedido y el total firmado.
    const checkout = await readCheckout(page);
    expect(checkout.reference).toMatch(/^PED-[0-9A-F]{16}$/);
    expect(checkout.amountInCents).toBe(100_000 * 100);
    expect(checkout.redirectUrl).toBe(page.url());

    // Mientras paga, las unidades quedan apartadas para los demás.
    const visitor = await page.context().browser()!.newPage();
    await visitor.goto(`/tienda/${product.id}`);
    await expect(visitor.getByLabel("Unidades").locator("option")).toHaveCount(1);
    await visitor.close();

    // Wompi avisa que el pago fue aprobado.
    const event = signedWompiEvent({
      id: `e2e-ped-${Date.now()}`,
      reference: checkout.reference,
      amountInCents: checkout.amountInCents,
      status: "APPROVED",
    });
    const res = await request.post("/api/webhooks/wompi", { data: event });
    expect(await res.json()).toEqual({ result: "paid" });
    const again = await request.post("/api/webhooks/wompi", { data: event });
    expect(await again.json()).toEqual({ result: "duplicate" });

    await page.reload();
    await expect(page.getByTestId("order-status")).toContainText("Pagado");
    await expect(page.getByTestId("wompi-form")).toHaveCount(0);
    expect(await productStock(product.id)).toBe(1);

    const email = await waitForEmail(user.email, "Recibimos el pago de tu pedido");
    expect(email.Text).toContain(`2 × ${product.name}`);

    await page.getByRole("link", { name: "Ver todos mis pedidos" }).click();
    await expect(page.getByRole("heading", { name: "Mis pedidos" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pedido #\d+.*Pagado/ })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("con envío: suma la tarifa fija y exige la dirección", async ({ page }) => {
    const product = await createTestProduct({ name: "Base de prueba", priceCop: 80_000, stock: 5 });
    const user = await createTestUser({ name: "Clienta Envío" });
    const fee = await shippingFee();

    await login(page, user.email, user.password, `/tienda/${product.id}`);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto("/carrito");
    await page.getByRole("radio", { name: /Envío a domicilio/ }).check();
    expect(digits(await page.getByTestId("total").textContent())).toBe(String(80_000 + fee));

    await page.getByLabel("Celular").fill("3001234567");
    await page.getByLabel(/acepto las condiciones de compra/).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page.getByText("Escribe la dirección de envío")).toBeVisible();

    await page.getByLabel("Dirección de envío").fill("Calle 10 # 20-30");
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByLabel(/acepto las condiciones de compra/).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");
    await expect(page.getByTestId("order-delivery")).toHaveText("Envío a domicilio");
    expect(digits(await page.getByTestId("order-total").textContent())).toBe(String(80_000 + fee));
    await expect(page.getByText("Calle 10 # 20-30, Medellín")).toBeVisible();
  });

  test("nunca se vende de más: lo apartado se ve agotado y vuelve al cancelar", async ({
    page,
    browser,
  }) => {
    const product = await createTestProduct({ name: "Último en stock", stock: 1 });
    const buyer = await createTestUser();

    // Otra persona lo tiene en el carrito.
    const other = await browser.newPage();
    await addToCart(other, product.id);

    // La compradora hace el pedido y aparta la única unidad.
    await login(page, buyer.email, buyer.password, `/tienda/${product.id}`);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto("/carrito");
    await page.getByLabel("Celular").fill("3001234567");
    await page.getByLabel(/acepto las condiciones de compra/).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");

    await other.goto("/carrito");
    await expect(other.getByTestId("cart-line")).toContainText("Agotado");
    await other.goto(`/tienda/${product.id}`);
    await expect(other.getByTestId("out-of-stock")).toBeVisible();

    // Al cancelar, la unidad vuelve a estar disponible.
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Cancelado");
    await other.reload();
    await expect(other.getByTestId("out-of-stock")).toHaveCount(0);
    await other.goto("/carrito");
    await expect(other.getByTestId("cart-line")).not.toContainText("Agotado");
    await other.close();
  });
});

test.describe("Panel de la tienda", () => {
  test("la admin crea un producto con foto y avanza un pedido pagado", async ({ page }) => {
    test.setTimeout(90_000);
    const customer = await createTestUser();
    const sold = await createTestProduct({ name: "Vendido", stock: 4 });
    const recipient = `Recibe ${Math.random().toString(36).slice(2, 7)}`;
    const order = await insertPaidOrder({
      customerId: customer.id,
      product: sold,
      recipientName: recipient,
    });

    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);
    await page.getByRole("link", { name: /Productos/ }).click();
    await expect(page.getByRole("heading", { name: "Productos", level: 1 })).toBeVisible();

    // Crear el producto.
    const name = `Rubor de prueba ${Math.random().toString(36).slice(2, 7)}`;
    const form = page.getByRole("region", { name: "Nuevo producto" });
    await form.getByLabel("Nombre").fill(name);
    await form.getByLabel("Categoría").selectOption({ label: "Rostro" });
    await form.getByLabel("Precio con IVA (pesos)").fill("65000");
    await form.getByLabel("Unidades en el estudio").fill("7");
    await form.getByRole("button", { name: "Crear producto" }).click();
    await expect(form.getByTestId("form-message")).toHaveText(`Producto «${name}» creado.`);
    await expectNoA11yViolations(page);

    // Subirle una foto.
    const item = page.getByRole("listitem").filter({ hasText: name });
    await item.getByText(name).click();
    await item.getByLabel("Foto (JPG, PNG o WebP, máximo 5 MB)").setInputFiles({
      name: "rubor.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });
    await item.getByLabel("Descripción de la foto").fill("Rubor rosado abierto");
    await item.getByRole("button", { name: "Subir foto" }).click();
    await expect(item.getByText("Foto agregada.")).toBeVisible();
    await expect(item.getByRole("img", { name: "Rubor rosado abierto" })).toBeVisible();

    // Un archivo que no es imagen se rechaza aunque diga .png.
    await item.getByLabel("Foto (JPG, PNG o WebP, máximo 5 MB)").setInputFiles({
      name: "falsa.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg onload=alert(1)>"),
    });
    await item.getByLabel("Descripción de la foto").fill("Archivo falso");
    await item.getByRole("button", { name: "Subir foto" }).click();
    await expect(item.getByText("Ese archivo no es una foto JPG, PNG o WebP.")).toBeVisible();

    // La tienda lo muestra con su foto.
    const shop = await page.context().browser()!.newPage();
    await shop.goto(`/tienda?q=${encodeURIComponent(name)}`);
    const card = shop.getByRole("link", { name: new RegExp(name) });
    await expect(card).toBeVisible();
    const photo = card.getByRole("img", { name: "Rubor rosado abierto" });
    await expect(photo).toBeVisible();
    // Sin estilos en línea (la CSP los bloquea) y la foto llena su recuadro.
    await expect(photo).not.toHaveAttribute("style");
    const [photoBox, frameBox] = await Promise.all([
      photo.boundingBox(),
      photo.locator("..").boundingBox(),
    ]);
    expect(photoBox?.width).toBeCloseTo(frameBox!.width, 0);
    expect(photoBox?.height).toBeCloseTo(frameBox!.height, 0);
    await shop.close();

    // Pedidos: pagado → listo para recoger → entregado.
    await page.goto("/admin/pedidos");
    const toPrepare = page
      .getByRole("list", { name: "Pedidos: Por preparar" })
      .getByRole("listitem")
      .filter({ hasText: `Pedido #${order.number} ·` });
    await expect(toPrepare).toContainText(recipient);
    await expectNoA11yViolations(page);
    await toPrepare.getByRole("button", { name: "Marcar listo para recoger" }).click();
    await expect(toPrepare).toHaveCount(0);

    await page.goto("/admin/pedidos?estado=por-entregar");
    const toDeliver = page.getByRole("listitem").filter({ hasText: `Pedido #${order.number} ·` });
    await expect(toDeliver).toContainText("Listo para recoger");
    await toDeliver.getByRole("button", { name: "Marcar entregado" }).click();
    await expect(toDeliver).toHaveCount(0);

    await page.goto("/admin/pedidos?estado=cerrados");
    await expect(
      page.getByRole("listitem").filter({ hasText: `Pedido #${order.number} ·` }),
    ).toContainText("Entregado");
  });
});
