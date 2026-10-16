import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Página de inicio", () => {
  test("muestra el nombre del negocio y el título principal", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Estudio de Prueba/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("envía los encabezados de seguridad", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();

    expect(headers["content-security-policy"]).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("el nonce de la CSP cambia en cada petición", async ({ request }) => {
    const nonceOf = async () => {
      const res = await request.get("/");
      return /'nonce-([^']+)'/.exec(res.headers()["content-security-policy"] ?? "")?.[1];
    };
    const [a, b] = [await nonceOf(), await nonceOf()];
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test("no hay errores en consola (incluye bloqueos de la CSP)", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("no tiene problemas de accesibilidad WCAG 2.1 AA detectables", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("el botón de WhatsApp abre el chat en una pestaña nueva", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /whatsapp/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/573001234567/);
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("el enlace 'Saltar al contenido' aparece al navegar con teclado", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "La navegación con teclado aplica a escritorio");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});

test.describe("Diseño móvil", () => {
  test("no hay desplazamiento horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("los enlaces y botones visibles miden al menos 44 px", async ({ page }) => {
    await page.goto("/");
    const small = await page.$$eval("a, button", (elements) =>
      elements
        .filter((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
        })
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(small).toEqual([]);
  });
});

test.describe("PWA y rutas técnicas", () => {
  test("el manifiesto es válido para instalar la app", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(icon.src)).ok()).toBeTruthy();
    }
  });

  test("el chequeo de salud responde ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("una ruta inexistente muestra la página 404 en español", async ({ page }) => {
    const res = await page.goto("/esta-pagina-no-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});
