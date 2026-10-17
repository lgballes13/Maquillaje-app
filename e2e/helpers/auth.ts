import type { Page } from "@playwright/test";
import { expect } from "../fixtures";
import { generateTotp, totpStep } from "./totp";

export async function login(page: Page, email: string, password: string, next = "/admin") {
  await page.goto(`/ingresar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  // Esperamos la respuesta del servidor antes de seguir (evita carreras entre envíos).
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === "POST"),
    page.getByRole("button", { name: "Ingresar" }).click(),
  ]);
}

/** Configura el 2FA del admin y devuelve la clave secreta y la ventana del código usado. */
export async function enrollTotp(page: Page) {
  await expect(page).toHaveURL(/\/admin\/seguridad$/);
  await page.getByRole("button", { name: "Generar código QR" }).click();
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
  await page.getByText("¿No puedes escanear?").click();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();

  const step = totpStep();
  await page.getByLabel("Código de 6 números").fill(generateTotp(secret, step));
  await page.getByRole("button", { name: "Activar verificación en dos pasos" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return { secret, step };
}
