import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { waitForEmailLink } from "./helpers/mailpit";
import { createTestUser, TEST_PASSWORD, uniqueEmail } from "./helpers/supabase";

async function login(page: Page, email: string, password: string) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  // Esperamos la respuesta del servidor antes de seguir (evita carreras entre envíos).
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === "POST"),
    page.getByRole("button", { name: "Ingresar" }).click(),
  ]);
}

test.describe("Registro", () => {
  test("exige autorizar el tratamiento de datos", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("ana"));
    await page.getByLabel("Contraseña").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Debes autorizar el tratamiento de tus datos")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("valida la contraseña corta y el correo inválido", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page.getByLabel("Contraseña").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Escribe un correo válido")).toBeVisible();
    await expect(page.getByText("al menos 12 caracteres")).toBeVisible();
  });

  test("crea la cuenta y entra a «Mi cuenta»", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("ana"));
    await page.getByLabel("Celular (opcional)").fill("300 123 4567");
    await page.getByLabel("Contraseña").fill(TEST_PASSWORD);
    await page.getByLabel(/Autorizo el tratamiento/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/cuenta$/);
    await expect(page.getByRole("heading", { name: "Hola, Ana Pérez" })).toBeVisible();
    await expect(page.getByText("+573001234567")).toBeVisible();
    await expect(page.getByRole("link", { name: "Mi cuenta" })).toBeVisible();
  });
});

test.describe("Inicio y cierre de sesión", () => {
  test("rechaza una contraseña incorrecta con un mensaje genérico", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/ingresar");
    await login(page, user.email, "ContraseñaEquivocada1");
    await expect(page.getByTestId("form-message")).toHaveText("Correo o contraseña incorrectos.");
  });

  test("una página privada pide ingresar y luego regresa a ella", async ({ page }) => {
    const user = await createTestUser({ name: "Laura Gómez" });
    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fcuenta/);
    await login(page, user.email, user.password);
    await expect(page).toHaveURL(/\/cuenta$/);
    await expect(page.getByRole("heading", { name: "Hola, Laura Gómez" })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  });

  test("no redirige a otros sitios después de ingresar (redirección abierta)", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/ingresar?next=https://sitio-malicioso.example");
    await login(page, user.email, user.password);
    await expect(page).toHaveURL(/localhost:\d+\/cuenta$/);
  });

  test("bloquea tras demasiados intentos fallidos", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/ingresar");
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login(page, user.email, `Equivocada${attempt}xxxxx`);
      await expect(page.getByTestId("form-message")).toHaveText("Correo o contraseña incorrectos.");
    }
    // El sexto intento se bloquea aunque la contraseña sea la correcta.
    await login(page, user.email, user.password);
    await expect(page.getByTestId("form-message")).toContainText("demasiados intentos");
  });
});

test.describe("Recuperar contraseña", () => {
  test("envía el enlace por correo y permite crear una contraseña nueva", async ({ page }) => {
    const user = await createTestUser();
    const newPassword = "MiNuevaClaveSegura2026";

    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill(user.email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByTestId("form-message")).toContainText("Si el correo está registrado");

    const link = await waitForEmailLink(user.email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/restablecer$/);

    await page.getByLabel("Contraseña nueva", { exact: true }).fill(newPassword);
    await page.getByLabel("Repite la contraseña nueva").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/cuenta\?clave=actualizada$/);
    await expect(page.getByText("Tu contraseña se actualizó correctamente.")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/ingresar");
    await login(page, user.email, newPassword);
    await expect(page).toHaveURL(/\/cuenta$/);
  });

  test("no revela si el correo existe", async ({ page }) => {
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("no-existe"));
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByTestId("form-message")).toContainText("Si el correo está registrado");
  });
});

test.describe("Accesibilidad de los formularios", () => {
  for (const path of ["/ingresar", "/registro", "/recuperar", "/privacidad"]) {
    test(`${path} no tiene problemas WCAG 2.1 AA detectables`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
