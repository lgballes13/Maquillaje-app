import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openMainNav } from "./helpers/nav";
import { createPortfolioCategory, createPublishedWork } from "./helpers/supabase";

test.describe("Página de inicio", () => {
  test("muestra el nombre del negocio y el título principal", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Estudio de Prueba/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("el hero muestra el título de la marca y sus dos acciones", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu belleza, elevada");
    const hero = page.getByRole("region", { name: "Tu belleza, elevada" });
    await expect(hero.getByRole("link", { name: "Agendar cita" })).toHaveAttribute(
      "href",
      "/agendar",
    );
    await expect(hero.getByRole("link", { name: "Ver portafolio" })).toHaveAttribute(
      "href",
      "/portafolio",
    );
    // La imagen del hero carga de inmediato (es lo primero que se ve).
    const heroImage = hero.getByRole("img", { name: /Bodegón de maquillaje/ });
    await expect(heroImage).toHaveAttribute("loading", "eager");
    await expect
      .poll(() => heroImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("los servicios y los módulos destacados llevan a su sección", async ({ page }) => {
    await page.goto("/");
    const services = page.getByRole("region", { name: "Un look para cada momento" });
    for (const name of ["Maquillaje social", "Maquillaje de novia", "Asesoría personalizada"]) {
      await expect(services.getByRole("heading", { name, level: 3 })).toBeVisible();
      await expect(
        services.getByRole("link", { name: `Agendar ${name.toLowerCase()}` }),
      ).toHaveAttribute("href", "/agendar");
    }
    const modules = page.getByRole("region", { name: /Agenda, compra y déjate inspirar/ });
    for (const [name, href] of [
      ["Ver horarios disponibles", "/agendar"],
      ["Ir a la tienda", "/tienda"],
      ["Ver portafolio", "/portafolio"],
    ] as const) {
      await expect(modules.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    // Las ilustraciones cargan (no quedan cuadros vacíos).
    for (const img of await page.getByRole("main").getByRole("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test("el encabezado tiene logo, menú, ingresar y carrito", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Estudio de Prueba" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Ingresar" })).toBeVisible();
    await expect(banner.getByTestId("cart-link")).toBeVisible();
    const nav = await openMainNav(page);
    for (const name of ["Agendar", "Tienda", "Portafolio"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
  });

  test("el menú del celular se abre, se cierra con Escape y marca la página actual", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "El botón de menú solo existe en el celular");
    await page.goto("/tienda");
    const button = page.getByRole("button", { name: "Menú" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Tienda" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(nav).toBeHidden();

    await button.click();
    await nav.getByRole("link", { name: "Portafolio" }).click();
    await expect(page).toHaveURL(/\/portafolio$/);
    await expect(nav).toBeHidden();
  });

  test("la galería filtra los trabajos publicados sin recargar la página", async ({ page }) => {
    const suffix = Math.random().toString(36).slice(2, 7);
    const withWork = await createPortfolioCategory("Galería");
    const empty = await createPortfolioCategory("Vacía");
    const title = `Look de galería ${suffix}`;
    await createPublishedWork({ categoryId: withWork.id, title });

    await page.goto("/");
    const gallery = page.getByRole("region", { name: "Trabajos reales" });
    const filters = gallery.getByRole("group", { name: "Filtrar trabajos por categoría" });
    await expect(filters.getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const works = gallery.getByRole("list", { name: "Trabajos destacados" });
    await expect(works.getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await filters.getByRole("button", { name: withWork.name }).click();
    await expect(filters.getByRole("button", { name: withWork.name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(works.getByRole("listitem")).toHaveCount(1);
    await expect(gallery.getByRole("status")).toHaveText(`1 trabajo de ${withWork.name}`);

    await filters.getByRole("button", { name: empty.name }).click();
    await expect(gallery.getByTestId("gallery-empty-category")).toContainText(empty.name);

    await filters.getByRole("button", { name: "Todos" }).click();
    await works.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(/\/portafolio\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  });

  test("los testimonios de ejemplo se marcan como ejemplo", async ({ page }) => {
    await page.goto("/");
    const testimonials = page.getByRole("region", { name: "Lo que dicen nuestras clientas" });
    await expect(testimonials.getByRole("listitem")).toHaveCount(3);
    await expect(testimonials.getByText("Ejemplo", { exact: true })).toHaveCount(3);
  });

  test("la franja final lleva a agendar y a WhatsApp", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("region", { name: /Reserva tu cita/ });
    await expect(cta.getByRole("link", { name: "Agendar cita" })).toHaveAttribute(
      "href",
      "/agendar",
    );
    const whatsapp = cta.getByRole("link", { name: /Escribir por WhatsApp/ });
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/573001234567/);
    await expect(whatsapp).toHaveAttribute("target", "_blank");
  });

  test("el pie de página tiene secciones, contacto y textos legales", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    const explore = footer.getByRole("navigation", { name: "Explora" });
    for (const [name, href] of [
      ["Agendar cita", "/agendar"],
      ["Tienda", "/tienda"],
      ["Portafolio", "/portafolio"],
      ["Mi cuenta", "/cuenta"],
    ] as const) {
      await expect(explore.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    await expect(footer.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\//,
    );
    const legal = footer.getByRole("navigation", { name: "Información legal" });
    await expect(legal.getByRole("link", { name: "Términos y condiciones" })).toBeVisible();
    await expect(
      legal.getByRole("link", { name: "Política de tratamiento de datos" }),
    ).toBeVisible();
    // Sin enlaces configurados, las redes sociales no aparecen.
    await expect(footer.getByRole("list", { name: "Redes sociales" })).toHaveCount(0);
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
    const link = page.getByRole("link", { name: /Escríbenos por WhatsApp/ });
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
