import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import { createTestUser } from "./helpers/supabase";
import { nextFreshTotp } from "./helpers/totp";

test.describe("Acceso al panel", () => {
  test("sin sesión, /admin pide ingresar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fadmin/);
  });

  test("una clienta no puede ver el panel (404)", async ({ page }) => {
    const user = await createTestUser();
    await login(page, user.email, user.password, "/cuenta");
    await expect(page).toHaveURL(/\/cuenta$/);
    const res = await page.goto("/admin/reglas");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Panel" })).toHaveCount(0);
  });

  test("el admin debe activar 2FA la primera vez y luego usarlo en cada inicio de sesión", async ({
    page,
    context,
  }) => {
    // Puede esperar hasta 30 s a que la app genere un código nuevo.
    test.setTimeout(90_000);
    const admin = await createTestUser({ admin: true, name: "Admin Prueba" });

    // Primer ingreso: obliga a configurar el segundo factor.
    await login(page, admin.email, admin.password);
    const { secret, step } = await enrollTotp(page);
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();

    // Cierra sesión y vuelve a entrar: ahora pide el código.
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await context.clearCookies();
    await login(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin\/verificar/);

    await page.getByLabel("Código de 6 números").fill("000000");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByTestId("form-message")).toContainText("El código no es válido");

    await page.getByLabel("Código de 6 números").fill(await nextFreshTotp(secret, step));
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("Reglas del negocio", () => {
  test("el admin crea una versión nueva y edita el horario", async ({ page }) => {
    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);

    await page.getByRole("link", { name: /Reglas del negocio/ }).click();
    await expect(page.getByRole("heading", { name: "Reglas del negocio", level: 1 })).toBeVisible();

    // Guardar sin cambios no crea versión.
    await page.getByLabel("Motivo del cambio").fill("Sin cambios");
    await page.getByRole("button", { name: "Guardar como versión nueva" }).click();
    await expect(page.getByTestId("form-message")).toContainText("No cambiaste ningún valor");

    // Valor fuera de rango: error en el campo.
    const deposit = page.getByLabel("Anticipo para reservar (%)");
    await deposit.fill("150");
    await page.getByRole("button", { name: "Guardar como versión nueva" }).click();
    await expect(page.getByText("Anticipo: máximo 100 %")).toBeVisible();

    // Cambio válido: crea una versión y aparece en el historial. Usamos un valor
    // al azar distinto del actual porque otras pruebas comparten la base de datos.
    const previous = await deposit.inputValue();
    let newValue = previous;
    while (newValue === previous) newValue = String(Math.floor(Math.random() * 90) + 5);
    await deposit.fill(newValue);
    await page.getByLabel("Motivo del cambio").fill("Prueba automática de anticipo");
    await page.getByRole("button", { name: "Guardar como versión nueva" }).click();
    await expect(page.getByTestId("form-message")).toContainText(
      /Reglas guardadas como versión \d+/,
    );
    await expect(
      page.getByRole("cell", { name: "Prueba automática de anticipo" }).first(),
    ).toBeVisible();

    // Horario inválido: cierra antes de abrir.
    await page.getByLabel("Martes: hora de apertura").fill("18:00");
    await page.getByLabel("Martes: hora de cierre").fill("09:00");
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(
      page.getByText("Martes: La hora de cierre debe ser después de la de apertura"),
    ).toBeVisible();

    await page.getByLabel("Martes: hora de apertura").fill("09:00");
    await page.getByLabel("Martes: hora de cierre").fill("18:00");
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByText("Horario guardado.")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
