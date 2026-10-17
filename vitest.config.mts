import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Entiende los alias "@/..." definidos en tsconfig.json.
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Las pruebas E2E (carpeta e2e/) las corre Playwright, no Vitest.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
