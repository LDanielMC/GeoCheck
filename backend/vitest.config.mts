import { defineConfig } from "vitest/config";

// La URL de la base de pruebas la calcula tests/globalSetup.ts (con la regla de seguridad "_test")
// y tests/setupEnv.ts la deja en process.env de cada worker antes de cargar la app.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setupEnv.ts"],
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-test-secret-test-secret-1234",
      AUTH_RATE_LIMIT_MAX: "1000", // alto para no estorbar; rateLimit.test.ts crea su propia app con límite bajo
      TRUST_PROXY: "0",
    },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
