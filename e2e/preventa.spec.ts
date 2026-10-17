import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import { expectNoA11yViolations } from "./helpers/booking";
import { waitForEmail } from "./helpers/mailpit";
import {
  createTestProduct,
  createTestUser,
  giveCredit,
  preorderRules,
  productStock,
  setProductStock,
} from "./helpers/supabase";
import { signedWompiEvent } from "./helpers/wompi";

/*
 * Preventa (reservar un producto agotado con anticipo), lista de espera sin
 * pago y saldo a favor en la tienda. Cada prueba crea su propio producto.
 */

function digits(text: string | null): string {
  return (text ?? "").replace(/\D/g, "");
}

async function readCheckout(page: Page) {
  const form = page.getByTestId("wompi-form");
  const field = (name: string) => form.locator(`input[name="${name}"]`).inputValue();
  return {
    reference: await field("reference"),
    amountInCents: Number(await field("amount-in-cents")),
  };
}

async function approve(page: Page, checkout: { reference: string; amountInCents: number }) {
  const event = signedWompiEvent({
    id: `e2e-pre-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reference: checkout.reference,
    amountInCents: checkout.amountInCents,
    status: "APPROVED",
  });
  const res = await page.request.post("/api/webhooks/wompi", { data: event });
  return ((await res.json()) as { result: string }).result;
}

test.describe("Preventa", () => {
  test("reserva con anticipo, la admin marca que llegó y la clienta paga el saldo", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const rules = await preorderRules();
    const product = await createTestProduct({
      name: "Paleta en preventa",
      priceCop: 40_000,
      stock: 0,
    });
    const customer = await createTestUser({ name: "Clienta Preventa" });
    const subtotal = 80_000;
    const deposit = Math.ceil((subtotal * Math.round(rules.depositPercent * 100)) / 10000);

    // Agotado: en vez de comprar, se reserva.
    await login(page, customer.email, customer.password, `/tienda/${product.id}`);
    await expect(page.getByTestId("out-of-stock")).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(0);
    const box = page.getByTestId("preorder-box");
    await expect(box).toContainText(`${rules.depositPercent} %`);
    await expect(box).toContainText(`${rules.deliveryDays} días`);
    await expectNoA11yViolations(page);
    await box.getByRole("link", { name: "Reservar" }).click();

    await expect(page).toHaveURL(new RegExp(`/tienda/${product.id}/reservar$`));
    await page.getByLabel("Unidades").selectOption("2");
    expect(digits(await page.getByTestId("deposit").textContent())).toBe(String(deposit));
    expect(digits(await page.getByTestId("balance").textContent())).toBe(
      String(subtotal - deposit),
    );
    await expect(page.getByTestId("preorder-terms")).toContainText("retracto");
    await expect(page.getByTestId("preorder-terms")).toContainText(
      `${rules.balanceDays} días para pagar el saldo`,
    );
    await expectNoA11yViolations(page);

    await page.getByLabel("Celular").fill("300 123 4567");
    await page.getByLabel(/acepto las condiciones de la preventa/).check();
    await page.getByRole("button", { name: "Continuar al pago del anticipo" }).click();
    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Paga el anticipo" })).toBeVisible();
    expect(digits(await page.getByTestId("order-deposit").textContent())).toBe(String(deposit));
    const depositCheckout = await readCheckout(page);
    expect(depositCheckout.amountInCents).toBe(deposit * 100);
    expect(await approve(page, depositCheckout)).toBe("deposit_paid");

    await page.reload();
    await expect(page.getByTestId("order-status")).toHaveText("Reservado: esperando que llegue");
    await expect(page.getByTestId("preorder-info")).toContainText(`${rules.deliveryDays} días`);
    await expect(page.getByTestId("wompi-form")).toHaveCount(0);
    const orderUrl = page.url();
    const depositEmail = await waitForEmail(customer.email, "Reservaste");
    expect(depositEmail.Text).toContain(`2 × ${product.name}`);

    // La admin ve la preventa; sin unidades en el inventario no la deja marcar.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const admin = await createTestUser({ admin: true });
    await login(adminPage, admin.email, admin.password);
    await enrollTotp(adminPage);
    await adminPage.goto("/admin/pedidos?estado=preventas");
    const item = adminPage
      .getByRole("list", { name: "Pedidos: Preventas" })
      .locator(":scope > li")
      .filter({ hasText: product.name });
    await expect(item).toContainText("Reservado: esperando que llegue");
    await expectNoA11yViolations(adminPage);
    await item.getByRole("button", { name: "Marcar que llegó" }).click();
    await expect(item.getByTestId("form-message")).toContainText("Aún no hay unidades suficientes");

    await setProductStock(product.id, 2);
    await item.getByRole("button", { name: "Marcar que llegó" }).click();
    await expect(item.getByTestId("form-message")).toContainText("pague el saldo");
    await adminContext.close();

    // La clienta recibe el aviso y paga el saldo.
    const arrived = await waitForEmail(customer.email, "Llegó tu");
    expect(arrived.Text).toContain("paga el saldo");
    await page.goto(orderUrl);
    await expect(page.getByTestId("order-status")).toHaveText("Llegó: paga el saldo");
    await expect(page.getByTestId("balance-due")).toBeVisible();
    const balanceCheckout = await readCheckout(page);
    expect(balanceCheckout.amountInCents).toBe((subtotal - deposit) * 100);

    // Las unidades quedan apartadas para ella mientras paga.
    const visitor = await browser.newPage();
    await visitor.goto(`/tienda/${product.id}`);
    await expect(visitor.getByTestId("out-of-stock")).toBeVisible();
    await visitor.close();

    expect(await approve(page, balanceCheckout)).toBe("paid");
    await page.reload();
    await expect(page.getByTestId("order-status")).toContainText("Pagado");
    expect(await productStock(product.id)).toBe(0);
    await waitForEmail(customer.email, "Recibimos el pago de tu pedido");
  });

  test("sin sesión pide ingresar y un producto sin preventa no se puede reservar", async ({
    page,
  }) => {
    const product = await createTestProduct({
      name: "Sin preventa",
      stock: 0,
      allowPreorder: false,
    });
    await page.goto(`/tienda/${product.id}`);
    await expect(page.getByTestId("out-of-stock")).toBeVisible();
    await expect(page.getByTestId("preorder-box")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ingresa para recibir el aviso" })).toBeVisible();

    // Entrar directo a la página de reserva no sirve.
    const customer = await createTestUser();
    await login(page, customer.email, customer.password, `/tienda/${product.id}/reservar`);
    await expect(page).toHaveURL(new RegExp(`/tienda/${product.id}$`));
  });
});

test.describe("Lista de espera", () => {
  test("la clienta pide el aviso y le llega un correo cuando vuelven las unidades", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const product = await createTestProduct({ name: "Rímel agotado", stock: 0 });
    const customer = await createTestUser({ name: "Clienta Espera" });

    await login(page, customer.email, customer.password, `/tienda/${product.id}`);
    const form = page.getByTestId("waitlist-form");
    await expectNoA11yViolations(page);
    await form.getByRole("button", { name: "Avísame cuando llegue" }).click();
    await expect(form.getByTestId("form-message")).toContainText("te escribimos al correo");
    await expect(form.getByRole("button", { name: "Ya no quiero el aviso" })).toBeVisible();

    // Puede salirse y volver a inscribirse.
    await form.getByRole("button", { name: "Ya no quiero el aviso" }).click();
    await expect(form.getByRole("button", { name: "Avísame cuando llegue" })).toBeVisible();
    await form.getByRole("button", { name: "Avísame cuando llegue" }).click();
    await expect(form.getByRole("button", { name: "Ya no quiero el aviso" })).toBeVisible();

    // La admin vuelve a poner unidades desde el panel.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const admin = await createTestUser({ admin: true });
    await login(adminPage, admin.email, admin.password);
    await enrollTotp(adminPage);
    await adminPage.goto("/admin/productos");
    const item = adminPage.getByRole("listitem").filter({ hasText: product.name });
    await expect(item).toContainText("1 en lista de espera");
    await item.getByText(product.name).click();
    await item.getByLabel("Unidades en el estudio").fill("3");
    await item.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(item.getByTestId("form-message")).toContainText("actualizado");
    await adminContext.close();

    const email = await waitForEmail(customer.email, "Volvió");
    expect(email.Text).toContain(product.name);
    expect(email.Text).toContain(`/tienda/${product.id}`);

    await page.reload();
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeVisible();
    await expect(page.getByTestId("waitlist-form")).toHaveCount(0);
  });
});

test.describe("Saldo a favor en la tienda", () => {
  test("si el saldo cubre el pedido, queda pagado sin pasar por Wompi", async ({ page }) => {
    const product = await createTestProduct({
      name: "Pagado con saldo",
      priceCop: 30_000,
      stock: 2,
    });
    const customer = await createTestUser();
    await giveCredit(customer.id, 50_000);

    await login(page, customer.email, customer.password, `/tienda/${product.id}`);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto("/carrito");
    expect(digits(await page.getByTestId("credit-applied").textContent())).toBe("30000");
    expect(digits(await page.getByTestId("to-pay").textContent())).toBe("0");
    await page.getByLabel("Celular").fill("3001234567");
    await page.getByLabel(/acepto las condiciones de compra/).check();
    await page.getByRole("button", { name: "Confirmar pedido con mi saldo" }).click();

    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("order-status")).toContainText("Pagado");
    expect(digits(await page.getByTestId("order-credit").textContent())).toBe("30000");
    await expect(page.getByTestId("wompi-form")).toHaveCount(0);
    expect(await productStock(product.id)).toBe(1);
    await waitForEmail(customer.email, "Recibimos el pago de tu pedido");

    await page.goto("/cuenta");
    expect(digits(await page.getByTestId("credit-balance").textContent())).toBe("20000");
  });

  test("si el saldo no alcanza, se descuenta y Wompi cobra solo la diferencia", async ({
    page,
  }) => {
    const product = await createTestProduct({ name: "Saldo parcial", priceCop: 60_000, stock: 2 });
    const customer = await createTestUser();
    await giveCredit(customer.id, 25_000);

    await login(page, customer.email, customer.password, `/tienda/${product.id}`);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto("/carrito");
    expect(digits(await page.getByTestId("to-pay").textContent())).toBe("35000");
    await page.getByLabel("Celular").fill("3001234567");
    await page.getByLabel(/acepto las condiciones de compra/).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();

    await expect(page.getByTestId("order-status")).toHaveText("Pendiente de pago");
    expect((await readCheckout(page)).amountInCents).toBe(35_000 * 100);

    // Si cancela, el saldo vuelve.
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Cancelado");
    await page.goto("/cuenta");
    expect(digits(await page.getByTestId("credit-balance").textContent())).toBe("25000");
  });
});
