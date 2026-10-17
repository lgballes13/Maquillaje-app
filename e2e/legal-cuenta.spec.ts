import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import { login } from "./helpers/auth";
import { expectNoA11yViolations } from "./helpers/booking";
import {
  accountState,
  cancelAppointmentInDb,
  createTestUser,
  insertAppointment,
  setProfilePhone,
} from "./helpers/supabase";

/*
 * Fase 8: textos legales, SEO básico y los derechos de la clienta sobre sus
 * datos (descargarlos y eliminar la cuenta).
 */

test.describe("Textos legales y SEO", () => {
  test("términos y privacidad se abren desde el pie de página", async ({ page }) => {
    await page.goto("/");
    const legal = page.getByRole("navigation", { name: "Información legal" });

    await legal.getByRole("link", { name: "Términos y condiciones" }).click();
    await expect(
      page.getByRole("heading", { name: "Términos y condiciones", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /Derecho de retracto/ })).toBeVisible();
    await expect(page.getByText(/5 días hábiles/).first()).toBeVisible();
    await expectNoA11yViolations(page);

    await page
      .getByRole("navigation", { name: "Información legal" })
      .getByRole("link", { name: "Política de tratamiento de datos" })
      .click();
    await expect(
      page.getByRole("heading", { name: /tratamiento de datos/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/Ley 1581/).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("robots, sitemap y datos del negocio", async ({ page, request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /admin");
    expect(robotsText).toContain("Disallow: /cuenta");
    expect(robotsText).toMatch(/Sitemap: .*\/sitemap\.xml/);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    for (const path of ["/agendar", "/tienda", "/portafolio", "/terminos", "/privacidad"]) {
      expect(sitemapText).toContain(`${path}</loc>`);
    }
    expect(sitemapText).not.toContain("/admin");

    await page.goto("/");
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    expect(jsonLd["@type"]).toBe("BeautySalon");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
  });
});

test.describe("Mis datos personales", () => {
  test("descargar mis datos entrega un JSON con la cuenta y las citas", async ({ page }) => {
    const user = await createTestUser({ name: "Clienta Descarga" });
    await setProfilePhone(user.id, "+573001112233");
    const appointment = await insertAppointment({
      customerId: user.id,
      hoursFromNow: 24 * 20,
      jitterHours: 24 * 5,
    });

    await login(page, user.email, user.password, "/cuenta");
    await expect(page.getByRole("heading", { name: "Tus datos personales" })).toBeVisible();
    await expectNoA11yViolations(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Descargar mis datos" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("mis-datos.json");
    const data = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(data.cuenta.correo).toBe(user.email);
    expect(data.cuenta.full_name).toBe("Clienta Descarga");
    expect(data.cuenta.phone).toBe("+573001112233");
    expect(data.citas.map((c: { starts_at: string }) => new Date(c.starts_at).getTime())).toContain(
      appointment.startsAt.getTime(),
    );

    // Sin sesión no se entrega nada.
    await page.context().clearCookies();
    const anonymous = await page.request.get("/cuenta/mis-datos", { maxRedirects: 0 });
    expect(anonymous.status()).not.toBe(200);

    await cancelAppointmentInDb(appointment.id);
  });

  test("eliminar la cuenta con historial la anonimiza y bloquea el acceso", async ({ page }) => {
    test.setTimeout(90_000);
    const user = await createTestUser({ name: "Clienta Que Se Va" });
    await setProfilePhone(user.id, "+573004445566");
    const appointment = await insertAppointment({
      customerId: user.id,
      hoursFromNow: 24 * 26,
      jitterHours: 24 * 5,
    });

    await login(page, user.email, user.password, "/cuenta");
    await page.getByText("Eliminar mi cuenta", { exact: true }).first().click();
    const password = page.getByLabel("Tu contraseña");
    const confirmation = page.getByLabel("Escribe ELIMINAR para confirmar");
    const submit = page.getByRole("button", { name: "Eliminar mi cuenta" });

    // 1. La palabra de confirmación es obligatoria.
    await password.fill(user.password);
    await confirmation.fill("borrar");
    await submit.click();
    await expect(page.getByText("Escribe ELIMINAR para confirmar.")).toBeVisible();

    // 2. Contraseña equivocada.
    await page.getByLabel("Tu contraseña").fill("NoEsLaClave123");
    await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
    await submit.click();
    await expect(page.getByText(/contraseña no es correcta/i)).toBeVisible();

    // 3. Con una cita pendiente no se puede.
    await page.getByLabel("Tu contraseña").fill(user.password);
    await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
    await submit.click();
    await expect(page.getByText(/Tienes una cita pendiente/)).toBeVisible();
    expect((await accountState(user.id)).profile?.full_name).toBe("Clienta Que Se Va");

    // 4. Sin citas en curso, se elimina.
    await cancelAppointmentInDb(appointment.id);
    await page.getByLabel("Tu contraseña").fill(user.password);
    await page.getByLabel("Escribe ELIMINAR para confirmar").fill("eliminar");
    await submit.click();
    await expect(page).toHaveURL(/\/cuenta-eliminada$/);
    await expect(page.getByRole("heading", { name: "Eliminamos tu cuenta" })).toBeVisible();
    await expectNoA11yViolations(page);

    const state = await accountState(user.id);
    expect(state.exists).toBe(true); // tiene historial: se conserva sin datos de contacto
    expect(state.email).not.toBe(user.email);
    expect(state.email).toMatch(/@cuenta-eliminada\.invalid$/);
    expect(state.bannedUntil).not.toBeNull();
    expect(state.profile).toEqual({ full_name: "Cuenta eliminada", phone: null });

    // Ya no puede entrar con su correo y contraseña.
    await login(page, user.email, user.password, "/cuenta");
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  });

  test("eliminar una cuenta sin historial la borra por completo", async ({ page }) => {
    const user = await createTestUser({ name: "Clienta Sin Citas" });
    await login(page, user.email, user.password, "/cuenta");
    await page.getByText("Eliminar mi cuenta", { exact: true }).first().click();
    await page.getByLabel("Tu contraseña").fill(user.password);
    await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
    await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
    await expect(page).toHaveURL(/\/cuenta-eliminada$/);

    const state = await accountState(user.id);
    expect(state.exists).toBe(false);
    expect(state.profile).toBeNull();
  });
});
