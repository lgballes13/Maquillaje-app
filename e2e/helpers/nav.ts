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

/**
 * Devuelve la barra lateral del panel. En el celular está detrás del botón
 * «Menú del panel», así que primero la abre.
 */
export async function openAdminNav(page: Page) {
  const menuButton = page.getByRole("button", { name: "Menú del panel" });
  if (await menuButton.isVisible()) await menuButton.click();
  return page.getByRole("navigation", { name: "Secciones del panel" });
}
