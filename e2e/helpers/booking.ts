import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect } from "../fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
}

export function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Un día hábil (lunes a sábado) al azar entre `from` y `to` días desde hoy. */
export function randomWorkday(from: number, to: number): string {
  for (;;) {
    const date = addDays(bogotaToday(), from + Math.floor(Math.random() * (to - from + 1)));
    if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 0) return date;
  }
}

/**
 * Abre una página de horarios (agendar o reprogramar) en un día al azar con
 * horarios libres. `path` es la página sin ?fecha=.
 */
async function openRandomDay(page: Page, path: string, slotName: RegExp) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const date = randomWorkday(3, 80);
    await page.goto(`${path}?fecha=${date}`);
    const slots = page.getByRole("link", { name: slotName });
    if ((await slots.count()) > 0) return { date, slots };
  }
  throw new Error("No se encontró un día con horarios libres");
}

/** Elige un horario al azar. Por defecto en "agendar"; para reprogramar pasa la ruta y el nombre. */
export async function pickRandomSlot(
  page: Page,
  serviceId: string,
  { path = `/agendar/${serviceId}`, slotName = /^Reservar a las/ } = {},
) {
  const { date, slots } = await openRandomDay(page, path, slotName);
  const count = await slots.count();
  const slot = slots.nth(Math.floor(Math.random() * count));
  const label = (await slot.getAttribute("aria-label"))!;
  await slot.click();
  return { date, label };
}

/**
 * Acepta la política y envía (reservar o cambiar de horario). Si otra prueba
 * cambió las reglas justo ahora, recarga y lo intenta de nuevo.
 */
export async function confirmBooking(page: Page, button: RegExp = /Apartar horario/) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel(/Leí y acepto la política de citas/).check();
    await page.getByRole("button", { name: button }).click();
    const status = page.getByTestId("appointment-status");
    const policyChanged = page
      .getByTestId("form-message")
      .filter({ hasText: "La política de citas cambió" });
    await expect(status.or(policyChanged)).toBeVisible();
    if (await status.isVisible()) return;
    await page.reload();
  }
  throw new Error("No se pudo confirmar la reserva");
}

export async function socialServiceId(page: Page): Promise<string> {
  await page.goto("/agendar");
  await page.getByRole("link", { name: "Elegir Maquillaje social" }).click();
  await expect(page).toHaveURL(/\/agendar\/[0-9a-f-]{36}/);
  return new URL(page.url()).pathname.split("/")[2]!;
}
