import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(32),
};

describe("parseConfig", () => {
  it("acepta una configuración mínima y aplica valores por defecto", () => {
    expect(parseConfig(valid)).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
      TRUST_PROXY: 0,
      AUTH_RATE_LIMIT_MAX: 10,
    });
  });

  it("lee PORT, TRUST_PROXY y AUTH_RATE_LIMIT_MAX como números", () => {
    const config = parseConfig({ ...valid, PORT: "8080", TRUST_PROXY: "1", AUTH_RATE_LIMIT_MAX: "25" });
    expect(config).toMatchObject({ PORT: 8080, TRUST_PROXY: 1, AUTH_RATE_LIMIT_MAX: 25 });
  });

  it("la clave de Places es opcional (una cadena vacía cuenta como ausente) y los límites tienen valores por defecto", () => {
    expect(parseConfig(valid)).toMatchObject({ PLACES_RATE_LIMIT_PER_MINUTE: 60, PLACES_RATE_LIMIT_PER_DAY: 300 });
    expect(parseConfig(valid).GOOGLE_PLACES_API_KEY).toBeUndefined();
    expect(parseConfig({ ...valid, GOOGLE_PLACES_API_KEY: "  " }).GOOGLE_PLACES_API_KEY).toBeUndefined();
    expect(parseConfig({ ...valid, GOOGLE_PLACES_API_KEY: " abc ", PLACES_RATE_LIMIT_PER_DAY: "50" })).toMatchObject({ GOOGLE_PLACES_API_KEY: "abc", PLACES_RATE_LIMIT_PER_DAY: 50 });
  });

  it("falla si falta DATABASE_URL", () => {
    expect(() => parseConfig({ JWT_SECRET: valid.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it("falla si falta JWT_SECRET o tiene menos de 32 caracteres", () => {
    expect(() => parseConfig({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/JWT_SECRET/);
    expect(() => parseConfig({ ...valid, JWT_SECRET: "x".repeat(31) })).toThrow(/32 caracteres/);
  });

  it("acepta el secreto de desarrollo fuera de producción, pero lo rechaza en producción", () => {
    const devSecret = { ...valid, JWT_SECRET: "dev-only-secret-change-me-before-deploying-0123456789" };
    expect(() => parseConfig(devSecret)).not.toThrow();
    expect(() => parseConfig({ ...devSecret, NODE_ENV: "production" })).toThrow(/producción/);
    expect(() => parseConfig({ ...valid, NODE_ENV: "production" })).not.toThrow();
  });

  it("junta todos los problemas en un solo mensaje", () => {
    expect(() => parseConfig({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });
});
