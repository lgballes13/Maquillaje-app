import type { Page } from "@playwright/test";

/**
 * Devuelve el menú principal visible. En el celular está detrás del botón
 * «Menú», así que primero lo abre.
 */
export async function openMainNav(page: Page) {
  const menuButton = page.getByRole("button", { name: "Menú" });
  if (await menuButton.isVisible()) await menuButton.click();
  return page.getByRole("navigation", { name: "Principal" });
}
