import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Entiende los alias "@/..." definidos en tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Las pruebas E2E (carpeta e2e/) las corre Playwright, no Vitest.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
