import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import {
  confirmBooking,
  expectNoA11yViolations,
  pickRandomSlot,
  randomWorkday,
  socialServiceId,
} from "./helpers/booking";
import { createTestUser } from "./helpers/supabase";
import { signedWompiEvent } from "./helpers/wompi";

/*
 * Flujo de citas y pagos. Las pruebas corren en paralelo contra la MISMA base
 * de datos y una sola agenda, así que cada una elige un día al azar para no
 * pelear por el mismo horario.
 */

async function readCheckout(page: Page) {
  const form = page.getByTestId("wompi-form");
  const field = (name: string) => form.locator(`input[name="${name}"]`).inputValue();
  return {
    action: await form.getAttribute("action"),
    reference: await field("reference"),
    amountInCents: Number(await field("amount-in-cents")),
    signature: await field("signature:integrity"),
    redirectUrl: await field("redirect-url"),
  };
}

test.describe("Agendar una cita", () => {
  test("la clienta elige servicio, día y hora, acepta la política y paga el anticipo", async ({
    page,
    browser,
    request,
  }) => {
    const user = await createTestUser({ name: "Clienta Agenda" });

    await page.goto("/");
    await page.getByRole("link", { name: "Agendar ahora" }).click();
    await expect(page.getByRole("heading", { name: "Elige tu servicio" })).toBeVisible();
    await expectNoA11yViolations(page);

    const serviceId = await socialServiceId(page);
    await expect(page.getByRole("heading", { name: "Elige día y hora" })).toBeVisible();
    const { date, label } = await pickRandomSlot(page, serviceId);
    const time = label.replace("Reservar a las ", "");

    // Sin sesión pide ingresar y luego vuelve a la confirmación.
    await expect(page).toHaveURL(/\/ingresar\?next=/);
    await page.getByLabel("Correo electrónico").fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("heading", { name: "Confirma tu cita" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Política de citas" })).toBeVisible();
    await expectNoA11yViolations(page);

    // Sin aceptar la política no deja continuar.
    await page.getByRole("button", { name: /Apartar horario/ }).click();
    await expect(page.getByText("Debes aceptar la política de citas para continuar")).toBeVisible();

    await confirmBooking(page);
    await expect(page.getByTestId("appointment-status")).toHaveText("Pendiente de pago");

    // El botón de pago lleva al checkout de Wompi con un monto firmado.
    const checkout = await readCheckout(page);
    expect(checkout.action).toBe("https://checkout.wompi.co/p/");
    expect(checkout.reference).toMatch(/^CITA-[0-9A-F]{16}$/);
    expect(checkout.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(checkout.redirectUrl).toBe(page.url());
    const deposit = (await page.getByTestId("deposit").textContent())!;
    expect(deposit.replace(/\D/g, "")).toBe(String(checkout.amountInCents / 100));
    await expectNoA11yViolations(page);

    // Otra persona ya no ve ese horario.
    const visitor = await browser.newPage();
    await visitor.goto(`/agendar/${serviceId}?fecha=${date}`);
    await expect(visitor.getByRole("heading", { name: /Horarios del/ })).toBeVisible();
    await expect(visitor.getByRole("link", { name: `Reservar a las ${time}` })).toHaveCount(0);
    await visitor.close();

    // Wompi avisa que el pago fue aprobado (webhook firmado).
    const event = signedWompiEvent({
      id: `e2e-${Date.now()}`,
      reference: checkout.reference,
      amountInCents: checkout.amountInCents,
      status: "APPROVED",
    });
    const res = await request.post("/api/webhooks/wompi", { data: event });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ result: "confirmed" });

    // El mismo aviso repetido no se aplica dos veces.
    const again = await request.post("/api/webhooks/wompi", { data: event });
    expect(await again.json()).toEqual({ result: "duplicate" });

    await page.reload();
    await expect(page.getByTestId("appointment-status")).toContainText("Confirmada");
    await expect(page.getByTestId("wompi-form")).toHaveCount(0);

    await page.getByRole("link", { name: "Ver todas mis citas" }).click();
    await expect(page.getByRole("heading", { name: "Mis citas" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Maquillaje social.*Confirmada/ })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("un pago rechazado deja la cita pendiente y permite reintentar", async ({
    page,
    request,
  }) => {
    const user = await createTestUser();
    await login(page, user.email, user.password, "/agendar");
    const serviceId = await socialServiceId(page);
    await pickRandomSlot(page, serviceId);
    await confirmBooking(page);
    const first = await readCheckout(page);

    const res = await request.post("/api/webhooks/wompi", {
      data: signedWompiEvent({
        id: `e2e-rechazo-${Date.now()}`,
        reference: first.reference,
        amountInCents: first.amountInCents,
        status: "DECLINED",
      }),
    });
    expect(await res.json()).toEqual({ result: "declined" });

    await page.reload();
    await expect(page.getByTestId("appointment-status")).toHaveText("Pendiente de pago");
    await expect(page.getByText("Tu pago anterior no fue aprobado")).toBeVisible();
    // El reintento usa una referencia nueva.
    expect((await readCheckout(page)).reference).not.toBe(first.reference);
  });
});

test.describe("Webhook de Wompi", () => {
  test("rechaza avisos sin firma válida o mal formados", async ({ request }) => {
    const forged = signedWompiEvent(
      { id: "falso-1", reference: "CITA-FALSA", amountInCents: 100, status: "APPROVED" },
      "test_events_otro_secreto",
    );
    const res = await request.post("/api/webhooks/wompi", { data: forged });
    expect(res.status()).toBe(401);

    const bad = await request.post("/api/webhooks/wompi", {
      data: "esto no es json",
      headers: { "content-type": "application/json" },
    });
    expect(bad.status()).toBe(400);
  });
});

test.describe("Panel: servicios y bloqueos", () => {
  test("el admin crea un servicio y bloquea un día de la agenda", async ({ page }) => {
    test.setTimeout(90_000);
    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);

    // Servicio nuevo: aparece para agendar.
    const name = `Peinado ${Math.random().toString(36).slice(2, 7)}`;
    await page.getByRole("link", { name: /Servicios/ }).click();
    const newService = page.getByRole("region", { name: "Nuevo servicio" });
    await newService.getByLabel("Nombre").fill(name);
    await newService.getByLabel("Duración (minutos)").fill("60");
    await newService.getByLabel("Precio (pesos)").fill("90000");
    await newService.getByRole("button", { name: "Crear servicio" }).click();
    await expect(page.getByTestId("form-message").first()).toContainText(`«${name}» creado`);
    await expectNoA11yViolations(page);

    await page.goto("/agendar");
    await page.getByRole("link", { name: `Elegir ${name}` }).click();
    await expect(page).toHaveURL(/\/agendar\/[0-9a-f-]{36}/);
    const serviceUrl = new URL(page.url()).pathname;

    // Bloquea un día completo (lejano, para no afectar a las otras pruebas).
    const day = randomWorkday(82, 88);
    const reason = `Prueba automática ${Math.random().toString(36).slice(2, 7)}`;
    await page.goto("/admin/citas");
    await expect(page.getByRole("heading", { name: "Citas", level: 1 })).toBeVisible();
    await page.getByLabel("Desde (fecha)").fill(day);
    await page.getByLabel("Desde (hora)").fill("00:00");
    await page.getByLabel("Hasta (fecha)").fill(day);
    await page.getByLabel("Hasta (hora)").fill("23:59");
    await page.getByLabel("Motivo (solo lo ves tú)").fill(reason);
    await page.getByRole("button", { name: "Bloquear horario" }).click();
    await expect(page.getByText("Horario bloqueado.")).toBeVisible();
    await expectNoA11yViolations(page);

    await page.goto(`${serviceUrl}?fecha=${day}`);
    await expect(page.getByText("No hay horarios libres este día")).toBeVisible();

    // Quita el bloqueo para dejar la agenda como estaba.
    await page.goto("/admin/citas");
    const block = page
      .getByRole("list", { name: "Bloqueos vigentes" })
      .getByRole("listitem")
      .filter({ hasText: reason });
    await block.getByRole("button", { name: "Quitar bloqueo" }).click();
    await page.goto(`${serviceUrl}?fecha=${day}`);
    await expect(page.getByRole("link", { name: /^Reservar a las/ }).first()).toBeVisible();
  });
});
