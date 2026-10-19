import { expect, test } from "./fixtures";
import { enrollTotp, login } from "./helpers/auth";
import { bogotaToday, expectNoA11yViolations } from "./helpers/booking";
import {
  cancelAppointmentInDb,
  createTestProduct,
  createTestUser,
  exportAuditRows,
  insertAppointment,
  insertPaidOrder,
  setProfilePhone,
} from "./helpers/supabase";
import { openAdminNav } from "./helpers/nav";

/*
 * Panel completo: agenda por día y semana, ficha de la clienta con nota
 * interna, reportes y descargas CSV (que quedan en la auditoría).
 */

function bogotaDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(instant);
}

test.describe("Panel de administración", () => {
  test("agenda, ficha de la clienta, reportes y descargas CSV", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const suffix = Math.random().toString(36).slice(2, 7);
    const name = `Clienta Panel ${suffix}`;
    const customer = await createTestUser({ name });
    await setProfilePhone(customer.id, "+573001234567");
    // Lejos en el futuro para no chocar con las otras pruebas.
    const appointment = await insertAppointment({
      customerId: customer.id,
      hoursFromNow: 24 * 70,
      jitterHours: 24 * 8,
    });
    const product = await createTestProduct({ name: `Sombra Panel ${suffix}` });
    // Muchas unidades para que quede entre los 10 más vendidos aunque otras pruebas vendan hoy.
    for (let i = 0; i < 2; i++) {
      await insertPaidOrder({
        customerId: customer.id,
        product,
        recipientName: name,
        quantity: 10,
      });
    }

    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);

    // 1. Agenda del día de la cita y luego la semana.
    await (await openAdminNav(page)).getByRole("link", { name: "Agenda" }).click();
    await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    const day = bogotaDate(appointment.startsAt);
    await page.getByLabel("Ir a la fecha").fill(day);
    await page.getByRole("button", { name: "Ver", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`fecha=${day}`));
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await expect(page.getByRole("link", { name: "Semana", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("main section")).toHaveCount(7);
    // Una cita que pasa la medianoche sale en los dos días: basta con la primera.
    await expect(page.getByRole("link", { name, exact: true }).first()).toBeVisible();
    await expectNoA11yViolations(page);

    // 2. Ficha de la clienta con nota interna.
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: customer.email })).toBeVisible();
    const summary = page.getByTestId("customer-summary");
    await expect(summary).toContainText("Citas1");
    await expect(summary).toContainText("Pedidos2");
    await page
      .getByRole("textbox", { name: /Nota interna/ })
      .fill("Piel sensible, prefiere tonos cálidos");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByTestId("form-message")).toHaveText("Nota guardada.");
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Nota interna/ })).toHaveValue(
      "Piel sensible, prefiere tonos cálidos",
    );
    await expectNoA11yViolations(page);

    // 3. Búsqueda y CSV de clientas (con correo y teléfono, sin fórmulas).
    await page.goto("/admin/clientas");
    await page.getByRole("searchbox", { name: "Buscar clienta" }).fill(customer.email);
    await page.getByRole("button", { name: "Buscar" }).click();
    const results = page.getByRole("list", { name: "Lista de clientas" }).locator(":scope > li");
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText(name);
    await expectNoA11yViolations(page);

    const exportHref = await page
      .getByRole("link", { name: /Descargar estos resultados/ })
      .getAttribute("href");
    const csv = await page.request.get(exportHref!);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(csv.headers()["content-disposition"]).toMatch(/attachment; filename="clientas_/);
    expect(csv.headers()["cache-control"]).toContain("no-store");
    const body = await csv.text();
    expect(body.startsWith("﻿Nombre;Correo;Teléfono")).toBe(true);
    expect(body).toContain(`${name};${customer.email};'+573001234567`);

    // Sin sesión de admin, la descarga no sale.
    const anonymous = await browser.newContext();
    const denied = await anonymous.request.get(exportHref!, { maxRedirects: 0 });
    expect(denied.status()).toBeGreaterThanOrEqual(300);
    expect(denied.headers().location ?? "").toContain("/ingresar");
    await anonymous.close();

    // 4. Reportes de hoy: el producto vendido aparece entre los más vendidos.
    const today = bogotaToday();
    await page.goto("/admin");
    await (await openAdminNav(page)).getByRole("link", { name: "Reportes" }).click();
    await page.getByLabel("Desde").fill(today);
    await page.getByLabel("Hasta").fill(today);
    await page.getByRole("button", { name: "Ver reporte" }).click();
    await expect(page.getByRole("heading", { name: "Productos más vendidos" })).toBeVisible();
    await expect(page.getByRole("cell", { name: product.name })).toBeVisible();
    await expectNoA11yViolations(page);

    const reportCsv = await page.request.get(
      `/admin/exportar/reporte?desde=${today}&hasta=${today}`,
    );
    expect(reportCsv.status()).toBe(200);
    expect(await reportCsv.text()).toContain(`Más vendido: ${product.name}`);
    const ordersCsv = await page.request.get(
      `/admin/exportar/pedidos?desde=${today}&hasta=${today}`,
    );
    expect(await ordersCsv.text()).toContain(`10 × ${product.name}`);

    // Rango inválido: aviso y se muestra el mes actual.
    await page.goto(`/admin/reportes?desde=${today}&hasta=2020-01-01`);
    await expect(page.getByText(/La fecha final no puede ser antes/)).toBeVisible();

    // 5. Cada descarga quedó en la auditoría.
    const audit = await exportAuditRows(admin.id);
    expect(audit.map((row) => row.record_id)).toEqual(["clientas", "reporte", "pedidos"]);
    expect(audit[0]!.new_data).toMatchObject({ busqueda: customer.email, filas: 1 });

    await cancelAppointmentInDb(appointment.id);
  });

  test("una clienta no entra a clientas, reportes ni descargas", async ({ page }) => {
    const customer = await createTestUser();
    await login(page, customer.email, customer.password, "/admin/clientas");
    for (const path of ["/admin/clientas", "/admin/reportes", "/admin/agenda"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    }
    const csv = await page.request.get("/admin/exportar/clientas", { maxRedirects: 0 });
    expect(csv.status()).toBe(404);
    expect(await csv.text()).not.toContain("Nombre;Correo");
  });
  test("el resumen muestra métricas, acciones rápidas, stock y la barra lateral", async ({
    page,
    isMobile,
  }) => {
    const suffix = Math.random().toString(36).slice(2, 7);
    // Agotado y con nombre que va primero, para que quede en la tabla de stock.
    const product = await createTestProduct({ name: `Aaa Resumen ${suffix}`, stock: 0 });
    const admin = await createTestUser({ admin: true });
    await login(page, admin.email, admin.password);
    await enrollTotp(page);

    await expect(page.getByRole("heading", { name: "Resumen", level: 1 })).toBeVisible();
    const metrics = page.getByRole("region", { name: "Métricas" });
    for (const label of ["Citas hoy", "Ingresos del mes", "Pedidos por entregar", "Stock bajo"]) {
      await expect(metrics.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
    const actions = page.getByRole("region", { name: "Acciones rápidas" });
    await expect(actions.getByRole("link", { name: "Nuevo producto" })).toHaveAttribute(
      "href",
      "/admin/productos#titulo-nuevo",
    );
    const stock = page.getByRole("region", { name: "Stock de la tienda" });
    await expect(
      stock.getByRole("row", { name: new RegExp(`${product.name}.*Agotado`) }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Próximas citas" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Actividad reciente" })).toBeVisible();
    await expectNoA11yViolations(page);

    // Barra lateral: marca la sección actual; en el celular se abre y se cierra con Escape.
    const nav = await openAdminNav(page);
    await expect(nav.getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (isMobile) {
      const button = page.getByRole("button", { name: "Menú del panel" });
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(button).toBeFocused();
      await expect(nav).toBeHidden();
      await (await openAdminNav(page)).getByRole("link", { name: "Pedidos" }).click();
    } else {
      await nav.getByRole("link", { name: "Pedidos" }).click();
    }
    await expect(page.getByRole("heading", { name: "Pedidos", level: 1 })).toBeVisible();
    await expect((await openAdminNav(page)).getByRole("link", { name: "Pedidos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
