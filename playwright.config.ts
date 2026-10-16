import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// Permite usar un Chromium ya instalado (útil en entornos sin descarga).
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // En CI falla si alguien dejó un test.only olvidado.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "escritorio-chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      // El ancho mínimo que exige el proyecto: 360 px (Android pequeño).
      name: "movil-360",
      use: {
        ...devices["Galaxy S9+"],
        viewport: { width: 360, height: 740 },
        launchOptions,
      },
    },
    {
      // Motor de Safari (iPhone). Requiere: npx playwright install webkit
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    // Probamos contra la versión de producción, no la de desarrollo.
    command: process.env.CI ? "npm run start" : "npm run build && npm run start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_BUSINESS_NAME: "Estudio de Prueba",
      NEXT_PUBLIC_WHATSAPP_NUMBER: "573001234567",
    },
  },
});
