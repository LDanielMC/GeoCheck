import { defineConfig } from "vitest/config";

// Prueba la lógica de la app (src) y la configuración de Expo (app.config.ts). Los módulos nativos de Expo se simulan en
// vitest.setup.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "app.config.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    clearMocks: true,
  },
});
