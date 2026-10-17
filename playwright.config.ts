import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { CRON_SECRET_TEST } from "./e2e/helpers/cron";
import { WOMPI_TEST } from "./e2e/helpers/wompi";

// Carga .env.local (claves de Supabase local) igual que lo hace Next.js.
loadEnvConfig(process.cwd());

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
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_WOMPI_PUBLIC_KEY: WOMPI_TEST.publicKey,
      WOMPI_INTEGRITY_SECRET: WOMPI_TEST.integritySecret,
      WOMPI_EVENTS_SECRET: WOMPI_TEST.eventsSecret,
      // Los correos de la app llegan al buzón de pruebas de Supabase (Mailpit).
      MAILPIT_URL: process.env.MAILPIT_URL ?? "http://127.0.0.1:54324",
      CRON_SECRET: CRON_SECRET_TEST,
    },
  },
});
