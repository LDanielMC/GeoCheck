import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { distanceInMeters, isInsideGeofence } from "../src/utils/geofence";
import { generateInviteCode, normalizeInviteCode } from "../src/utils/inviteCode";
import { resolveTestDatabaseUrl } from "./testDb";

describe("seguridad de la base de pruebas", () => {
  it("los tests corren contra una base cuyo nombre termina en _test", async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(rows[0].db).toMatch(/_test$/);
  });

  it("resolveTestDatabaseUrl deriva la base _test solo en servidores locales", () => {
    const local = resolveTestDatabaseUrl({ DATABASE_URL: "postgresql://u:p@localhost:5432/geocheck" });
    expect(new URL(local).pathname).toBe("/geocheck_test");

    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: "postgresql://u:p@aws-0.pooler.supabase.com:5432/postgres" })).toThrow(
      /no es local/
    );
  });

  it("resolveTestDatabaseUrl rechaza cualquier URL explícita que no termine en _test", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@localhost:5432/geocheck" })).toThrow(/_test/);
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@db.remoto.com:5432/ci_test" })).not.toThrow();
  });
});

describe("códigos de invitación", () => {
  it("tienen 8 caracteres y nunca usan I, L, O, 0 ni 1", () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateInviteCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    }
  });

  it("no se repiten en una muestra grande", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => generateInviteCode()));
    expect(codes.size).toBe(5000);
  });

  it("normalizeInviteCode acepta minúsculas, espacios y guiones", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("ab cd ef gh")).toBe("ABCDEFGH");
  });
});

describe("geofence", () => {
  it("la distancia entre un punto y sí mismo es 0", () => {
    expect(distanceInMeters(19.4284, -99.1677, 19.4284, -99.1677)).toBe(0);
  });

  it("un grado de latitud son ≈111 km", () => {
    expect(distanceInMeters(0, 0, 1, 0)).toBeGreaterThan(111_000);
    expect(distanceInMeters(0, 0, 1, 0)).toBeLessThan(111_400);
  });

  it("isInsideGeofence respeta el radio (≈0.001° de latitud ≈ 111 m)", () => {
    expect(isInsideGeofence(0.001, 0, 0, 0, 120)).toBe(true);
    expect(isInsideGeofence(0.001, 0, 0, 0, 100)).toBe(false);
  });
});
