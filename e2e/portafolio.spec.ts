import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import { expectNoA11yViolations } from "./helpers/booking";
import { createTestUser } from "./helpers/supabase";

/*
 * Portafolio: la admin registra la autorización firmada, crea el trabajo con
 * fotos de antes y después y lo publica; si la clienta retira la autorización,
 * el trabajo desaparece del sitio.
 */

// PNG de 1 × 1 píxel.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n% formato de prueba\n");

test.describe("Portafolio", () => {
  test("se publica solo con autorización y desaparece al retirarla", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const suffix = Math.random().toString(36).slice(2, 7);
    const client = `Clienta Portafolio ${suffix}`;
    const title = `Novia de prueba ${suffix}`;

    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);
    await page
      .getByRole("link", { name: /Portafolio/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Portafolio", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);

    // 1. Autorización firmada: un archivo que no es foto ni PDF se rechaza.
    const consents = page.getByRole("region", { name: "Autorizaciones firmadas" });
    await consents.getByLabel("Nombre de la clienta").fill(client);
    await consents.getByLabel(/Formato firmado/).setInputFiles({
      name: "falso.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<script>alert(1)</script>"),
    });
    await consents.getByRole("button", { name: "Registrar autorización" }).click();
    await expect(
      consents.getByText("Ese archivo no es una foto (JPG, PNG o WebP) ni un PDF."),
    ).toBeVisible();

    await consents.getByLabel(/Formato firmado/).setInputFiles({
      name: "autorizacion.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await consents.getByRole("button", { name: "Registrar autorización" }).click();
    await expect(consents.getByTestId("form-message")).toHaveText(
      `Autorización de ${client} registrada.`,
    );

    // El formato firmado se abre con un enlace temporal; sin sesión de admin, no.
    const consentItem = consents
      .getByRole("list", { name: "Autorizaciones registradas" })
      .locator(":scope > li")
      .filter({ hasText: client });
    await consentItem.getByText(client, { exact: true }).click();
    const href = await consentItem
      .getByRole("link", { name: /Ver el formato firmado/ })
      .getAttribute("href");
    const signed = await page.request.get(href!, { maxRedirects: 0 });
    expect(signed.status()).toBe(302);
    expect(signed.headers().location).toContain("/storage/v1/object/sign/autorizaciones/");
    const anonymous = await browser.newContext();
    const denied = await anonymous.request.get(href!, { maxRedirects: 0 });
    expect(denied.status()).toBeGreaterThanOrEqual(300);
    expect(denied.headers().location ?? "").toContain("/ingresar");
    await anonymous.close();

    // 2. Trabajo: sin foto de «después» no se publica.
    const form = page.getByRole("region", { name: "Nuevo trabajo" });
    const consentSelect = form.getByLabel("Autorización de la clienta");
    const consentValue = await consentSelect
      .locator("option", { hasText: client })
      .getAttribute("value");
    await consentSelect.selectOption(consentValue!);
    await form.getByLabel("Título").fill(title);
    await form.getByLabel("Categoría").selectOption({ label: "Novia" });
    await form.getByLabel("Servicio para «Agendar este estilo»").selectOption({ index: 1 });
    await form.getByRole("button", { name: "Crear trabajo" }).click();
    await expect(form.getByTestId("form-message")).toContainText(`Trabajo «${title}» creado`);

    const item = page
      .getByRole("region", { name: "Trabajos" })
      .locator(":scope li")
      .filter({
        has: page.getByText(title, { exact: true }),
      })
      .first();
    await item.getByText(title, { exact: true }).click();
    await item.getByRole("button", { name: "Publicar en el portafolio" }).click();
    await expect(
      item.getByText("Sube al menos una foto de «después» antes de publicar."),
    ).toBeVisible();

    // 3. Fotos de antes y después.
    for (const [kind, alt] of [
      ["Después", "Novia con maquillaje terminado"],
      ["Antes", "Novia sin maquillaje"],
    ] as const) {
      await item.getByRole("radio", { name: kind }).check();
      await item.getByLabel(/Foto del trabajo/).setInputFiles({
        name: "foto.png",
        mimeType: "image/png",
        buffer: PNG_1PX,
      });
      await item.getByLabel("Descripción de la foto").fill(alt);
      await item.getByRole("button", { name: "Subir foto" }).click();
      await expect(item.getByRole("img", { name: alt })).toBeVisible();
    }
    await item.getByRole("button", { name: "Publicar en el portafolio" }).click();
    await expect(item.getByRole("button", { name: "Ocultar del portafolio" })).toBeVisible();

    // 4. El sitio lo muestra con antes / después y «Agendar este estilo».
    const visitor = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const site = await visitor.newPage();
    await site.goto("/portafolio");
    await expect(site.getByRole("heading", { name: "Portafolio", level: 1 })).toBeVisible();
    const card = site.getByRole("link", { name: new RegExp(title) });
    await expect(card).toBeVisible();
    await expectNoA11yViolations(site);
    await card.click();
    await expect(site.getByRole("heading", { name: title })).toBeVisible();
    await expect(site.getByRole("link", { name: "Agendar este estilo" })).toHaveAttribute(
      "href",
      /^\/agendar\/[0-9a-f-]{36}$/,
    );
    const toggle = site.getByRole("button", { name: "Antes" });
    if (await toggle.isVisible()) {
      // Celular: se cambia entre antes y después con botones.
      await expect(site.getByRole("img", { name: "Novia sin maquillaje" })).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(site.getByRole("img", { name: "Novia sin maquillaje" })).toBeVisible();
    } else {
      await expect(site.getByRole("img", { name: "Novia sin maquillaje" })).toBeVisible();
      await expect(site.getByRole("img", { name: "Novia con maquillaje terminado" })).toBeVisible();
    }
    await expectNoA11yViolations(site);
    const workUrl = site.url();

    // 5. La clienta retira la autorización: se oculta y se borran sus fotos.
    page.once("dialog", (dialog) => dialog.accept());
    await consentItem.getByLabel("Motivo").fill("La clienta lo pidió por WhatsApp");
    await consentItem.getByRole("button", { name: /Retirar autorización/ }).click();
    await expect(consentItem.getByTestId("consent-revoked")).toContainText(
      "La clienta lo pidió por WhatsApp",
    );
    await page.reload();
    await expect(item).toContainText("Autorización retirada");
    await expect(item).toContainText("0 fotos");

    await site.goto(workUrl);
    await expect(site.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await site.goto("/portafolio");
    await expect(site.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
    await visitor.close();
  });

  test("una clienta no entra al panel del portafolio", async ({ page }) => {
    const customer = await createTestUser();
    await login(page, customer.email, customer.password, "/admin/portafolio");
    await page.goto("/admin/portafolio");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});
