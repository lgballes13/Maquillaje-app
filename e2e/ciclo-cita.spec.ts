import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import {
  addDays,
  bogotaToday,
  confirmBooking,
  expectNoA11yViolations,
  pickRandomSlot,
  socialServiceId,
} from "./helpers/booking";
import { CRON_SECRET_TEST } from "./helpers/cron";
import { waitForEmail } from "./helpers/mailpit";
import {
  cancelAppointmentInDb,
  createTestUser,
  currentRules,
  insertAppointment,
} from "./helpers/supabase";

/*
 * Lo que pasa después de reservar: cancelar, cambiar de horario, no asistir,
 * saldo a favor y correos. Las citas de partida se crean directo en la base
 * (insertAppointment) para poder ponerlas a cualquier hora, incluso en el pasado.
 * Todas tienen un anticipo de $180.000.
 */

const DEPOSIT = 180_000;

/** Solo los dígitos de un texto ("$ 126.000" → "126000"). */
async function digits(page: Page, testId: string): Promise<string> {
  return ((await page.getByTestId(testId).textContent()) ?? "").replace(/\D/g, "");
}

/** Penalidad redondeada hacia arriba al peso, igual que la app y la base de datos. */
function penaltyFor(deposit: number, percent: number): number {
  return Math.ceil((deposit * Math.round(percent * 100)) / 10000);
}

function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

test.describe("Cancelar una cita", () => {
  test("con anticipación: todo el anticipo queda a favor y se usa en la próxima reserva", async ({
    page,
  }) => {
    const user = await createTestUser({ name: "Clienta Cancela" });
    const appt = await insertAppointment({ customerId: user.id, hoursFromNow: 24 * 12 });

    await login(page, user.email, user.password, `/citas/${appt.id}`);
    const status = page.getByTestId("appointment-status");
    await expect(status).toContainText("Confirmada");
    await expect(page.getByRole("link", { name: "Cambiar horario" })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("link", { name: "Cancelar cita" }).click();
    await expect(page.getByTestId("cancel-preview")).toContainText("todo tu anticipo");
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Sí, cancelar mi cita" }).click();

    await expect(status).toHaveText("Cancelada");
    await expect(page.getByTestId("credit-movements")).toContainText(
      "Cancelación con anticipación",
    );
    await page.goto("/cuenta");
    expect(await digits(page, "credit-balance")).toBe(String(DEPOSIT));

    // La próxima reserva usa el saldo: como cubre todo el anticipo, se confirma sin pagar.
    const serviceId = await socialServiceId(page);
    await pickRandomSlot(page, serviceId);
    await expect(page.getByTestId("credit-applied")).toBeVisible();
    expect(await digits(page, "deposit")).toBe("0");
    await confirmBooking(page, /Confirmar cita/);
    await expect(status).toContainText("Confirmada");
    await expect(page.getByTestId("wompi-form")).toHaveCount(0);

    // Y llega el correo de confirmación.
    const email = await waitForEmail(user.email, "Tu cita quedó confirmada");
    expect(email.Text).toContain("Maquillaje social");
  });

  test("tarde: se descuenta la penalidad y el resto queda a favor", async ({ page }) => {
    const rules = await currentRules();
    test.skip(rules.free_cancellation_hours < 6, "La política vigente no tiene cancelación tardía");
    const user = await createTestUser();
    // Menos horas de las permitidas para cancelar sin costo (insertAppointment suma hasta 3 h).
    const appt = await insertAppointment({
      customerId: user.id,
      hoursFromNow: rules.free_cancellation_hours - 5,
    });
    const penalty = penaltyFor(DEPOSIT, rules.reschedule_penalty_percent);

    await login(page, user.email, user.password, `/citas/${appt.id}`);
    await expect(page.getByTestId("appointment-status")).toContainText("Confirmada");
    // Ya no se puede cambiar el horario, solo cancelar.
    await expect(page.getByRole("link", { name: "Cambiar horario" })).toHaveCount(0);
    await page.getByRole("link", { name: "Cancelar cita" }).click();

    const preview = page.getByTestId("cancel-preview");
    await expect(preview).toContainText(`se descuenta el ${rules.reschedule_penalty_percent} %`);
    expect(((await preview.textContent()) ?? "").replace(/\D/g, "")).toContain(
      String(DEPOSIT - penalty),
    );
    await page.getByRole("button", { name: "Sí, cancelar mi cita" }).click();

    await expect(page.getByTestId("appointment-status")).toHaveText("Cancelada");
    await expect(page.getByTestId("credit-movements")).toContainText("Cancelación tardía");
    await page.goto("/cuenta");
    expect(await digits(page, "credit-balance")).toBe(String(DEPOSIT - penalty));
  });
});

test.describe("Cambiar de horario", () => {
  test("con anticipación no cuesta nada y la cita vieja queda como reprogramada", async ({
    page,
  }) => {
    const user = await createTestUser();
    const appt = await insertAppointment({ customerId: user.id, hoursFromNow: 24 * 12 });

    await login(page, user.email, user.password, `/citas/${appt.id}`);
    await page.getByRole("link", { name: "Cambiar horario" }).click();
    await expect(page.getByRole("heading", { name: "Cambiar horario" })).toBeVisible();
    await expect(page.getByTestId("reschedule-info")).toContainText("no tiene costo");
    await expectNoA11yViolations(page);

    await pickRandomSlot(page, "", {
      path: `/citas/${appt.id}/reprogramar`,
      slotName: /^Cambiar a las/,
    });
    await expect(page.getByRole("heading", { name: "Confirma el cambio" })).toBeVisible();
    expect(await digits(page, "amount-due")).toBe("0");
    await expectNoA11yViolations(page);
    await confirmBooking(page, /Confirmar nuevo horario/);

    await expect(page).not.toHaveURL(new RegExp(appt.id));
    await expect(page.getByTestId("appointment-status")).toContainText("Confirmada");
    // El anticipo de la cita nueva sale del saldo (la política vigente puede pedir otro %).
    expect(await digits(page, "credit-applied")).toBe(await digits(page, "deposit"));
    await waitForEmail(user.email, "Tu cita quedó confirmada");

    await page.goto(`/citas/${appt.id}`);
    await expect(page.getByTestId("appointment-status")).toHaveText("Reprogramada");
    await expect(page.getByRole("link", { name: "Ver la cita nueva" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancelar cita" })).toHaveCount(0);
  });
});

test.describe("No asistió", () => {
  test("la admin marca «No asistió» y la clienta reprograma dentro del plazo", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const rules = await currentRules();
    test.skip(
      rules.reschedule_window_hours < 6,
      "El plazo para reprogramar de la política vigente es muy corto para esta prueba",
    );
    const name = `Clienta Ausente ${Math.random().toString(36).slice(2, 7)}`;
    const user = await createTestUser({ name });
    // Una cita que empezó hace unas horas (entre 2 y 5).
    const appt = await insertAppointment({ customerId: user.id, hoursFromNow: -2 });

    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);
    await page.goto("/admin/citas");
    const toMark = page.getByRole("list", { name: "Citas por marcar asistencia" });
    const item = toMark.getByRole("listitem").filter({ hasText: name });
    await expect(item).toBeVisible();
    await expectNoA11yViolations(page);
    await item.getByRole("button", { name: "No asistió" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);

    // La clienta, en su propio navegador.
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": randomIp() },
    });
    const customer = await context.newPage();
    await login(customer, user.email, user.password, `/citas/${appt.id}`);
    await expect(customer.getByTestId("appointment-status")).toHaveText("No asistió");
    const credit = DEPOSIT - penaltyFor(DEPOSIT, rules.reschedule_penalty_percent);
    const offer = customer.getByRole("region", { name: "¿Quieres reprogramar?" });
    expect(((await offer.textContent()) ?? "").replace(/\D/g, "")).toContain(String(credit));
    await expectNoA11yViolations(customer);

    await offer.getByRole("link", { name: "Reprogramar" }).click();
    await expect(customer.getByTestId("reschedule-info")).toContainText(
      new RegExp(`se descuenta el ${rules.reschedule_penalty_percent} %`, "i"),
    );
    await pickRandomSlot(customer, "", {
      path: `/citas/${appt.id}/reprogramar`,
      slotName: /^Cambiar a las/,
    });
    // Si el anticipo vigente es mayor que el saldo, falta pagar la diferencia.
    await confirmBooking(customer, /Confirmar nuevo horario|Cambiar horario y continuar al pago/);
    await expect(customer.getByTestId("appointment-status")).toHaveText(
      /Confirmada|Pendiente de pago/,
    );
    await expect(customer).not.toHaveURL(new RegExp(appt.id));

    // La cita original sigue como «No asistió», enlazada a la nueva, y ya no se puede volver a reprogramar.
    await customer.goto(`/citas/${appt.id}`);
    await expect(customer.getByTestId("appointment-status")).toHaveText("No asistió");
    await expect(customer.getByRole("link", { name: "Ver la cita nueva" })).toBeVisible();
    await expect(customer.getByRole("link", { name: "Reprogramar" })).toHaveCount(0);
    await context.close();
  });
});

test.describe("Recordatorios", () => {
  test("la tarea programada exige su secreto y envía el recordatorio de mañana", async ({
    request,
  }) => {
    const anonymous = await request.get("/api/cron/recordatorios");
    expect(anonymous.status()).toBe(401);
    const wrong = await request.get("/api/cron/recordatorios", {
      headers: { authorization: "Bearer otro-secreto-cualquiera" },
    });
    expect(wrong.status()).toBe(401);

    // Una cita mañana entre las 6 a. m. y las 9 p. m. (hora de Colombia).
    const user = await createTestUser();
    const tomorrow = Date.parse(`${addDays(bogotaToday(), 1)}T06:00:00-05:00`);
    const appt = await insertAppointment({
      customerId: user.id,
      hoursFromNow: (tomorrow - Date.now()) / 3_600_000,
      jitterHours: 15,
    });

    const res = await request.get("/api/cron/recordatorios", {
      headers: { authorization: `Bearer ${CRON_SECRET_TEST}` },
    });
    expect(res.status()).toBe(200);
    const email = await waitForEmail(user.email, "Recordatorio: tu cita es mañana");
    expect(email.Text).toContain("Maquillaje social");
    // Libera el horario para las próximas corridas en la misma base local.
    await cancelAppointmentInDb(appt.id);
  });
});
