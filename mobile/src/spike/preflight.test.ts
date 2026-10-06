import { describe, expect, it } from "vitest";
import { canStart, preflight, type PreflightInput } from "./preflight";

const OK: PreflightInput = {
  scenario: "3",
  batteryProfile: "default",
  foreground: "granted",
  foregroundAccuracy: "fine",
  background: "granted",
  servicesEnabled: true,
  batteryOptimization: true, // lo normal con el perfil por defecto
  lowPowerMode: false,
  notifications: "granted",
};
const ids = (checks: { id: string }[]) => checks.map((c) => c.id);

describe("comprobaciones antes de iniciar una sesión", () => {
  it("todo en orden con el perfil por defecto: nada bloquea ni avisa", () => {
    const result = preflight(OK);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(canStart(result, false)).toBe(true);
  });

  it("perfil «sin restricciones» con la optimización de batería activa BLOQUEA el inicio (el caso del 2026-10-05)", () => {
    const result = preflight({ ...OK, batteryProfile: "unrestricted", batteryOptimization: true });
    expect(ids(result.blockers)).toEqual(["battery_profile_mismatch"]);
    expect(result.blockers[0].message).toContain("MIUI es otro interruptor");
    expect(canStart(result, false)).toBe(false);
  });

  it("ese bloqueo se puede forzar con confirmación explícita, y solo ese", () => {
    const result = preflight({ ...OK, batteryProfile: "unrestricted", batteryOptimization: true });
    expect(canStart(result, true)).toBe(true);
    const noPermission = preflight({ ...OK, batteryProfile: "unrestricted", batteryOptimization: true, background: "denied" });
    expect(canStart(noPermission, true)).toBe(false);
  });

  it("también bloquea el caso inverso: ya no hay restricción pero el perfil dice «por defecto»", () => {
    const result = preflight({ ...OK, batteryProfile: "default", batteryOptimization: false });
    expect(ids(result.blockers)).toEqual(["battery_profile_mismatch"]);
  });

  it("si el sistema no informa la optimización de batería no se bloquea por eso", () => {
    expect(preflight({ ...OK, batteryProfile: "unrestricted", batteryOptimization: null }).blockers).toEqual([]);
  });

  it("sin permiso de ubicación o sin «Permitir todo el tiempo» bloquea, salvo en el escenario 8", () => {
    expect(ids(preflight({ ...OK, foreground: "denied" }).blockers)).toEqual(["foreground_permission"]);
    expect(ids(preflight({ ...OK, background: "denied" }).blockers)).toEqual(["background_permission"]);
    expect(preflight({ ...OK, scenario: "8", background: "denied" }).blockers).toEqual([]);
  });

  it("servicios de ubicación apagados siempre bloquea", () => {
    expect(ids(preflight({ ...OK, scenario: "8", servicesEnabled: false }).blockers)).toEqual(["services_off"]);
  });

  it("avisa (sin bloquear) de notificaciones apagadas y de ubicación aproximada", () => {
    const result = preflight({ ...OK, notifications: "denied", foregroundAccuracy: "coarse" });
    expect(result.blockers).toEqual([]);
    expect(ids(result.warnings)).toEqual(["notifications_denied", "coarse_location"]);
  });

  it("el ahorro de batería debe estar activo solo en el escenario 5", () => {
    expect(ids(preflight({ ...OK, scenario: "5", lowPowerMode: false }).warnings)).toEqual(["low_power_off"]);
    expect(preflight({ ...OK, scenario: "5", lowPowerMode: true }).warnings).toEqual([]);
    expect(ids(preflight({ ...OK, scenario: "2", lowPowerMode: true }).warnings)).toEqual(["low_power_on"]);
  });
});
