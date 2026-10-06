import { defineConfig } from "vitest/config";

// Prueba la lógica del spike (src/spike). Los módulos nativos de Expo se simulan en vitest.setup.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    clearMocks: true,
  },
});
