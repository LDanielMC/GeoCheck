import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Battery from "expo-battery";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { checkRegistration, endSession, openMiuiAutostart, requestBatteryExemption, startSession } from "./geofenceLab";
import { SPIKE_GEOFENCE_TASK } from "./geofenceTask";
import { readConfig, readLog, writeConfig } from "./spikeStorage";
import { resetFs } from "./testing/memoryFs";

const CENTER = { latitude: 19.428412345, longitude: -99.167712345 };
const kinds = () => readLog().map((e) => e.kind);

beforeEach(() => {
  resetFs();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
  // El teléfono de prueba real: la optimización de batería está activa por defecto.
  vi.mocked(Battery.isBatteryOptimizationEnabledAsync).mockResolvedValue(true);
  vi.mocked(Location.hasStartedGeofencingAsync).mockResolvedValue(false);
  vi.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue({ status: "granted", granted: true } as never);
  vi.mocked(Location.startGeofencingAsync).mockResolvedValue(undefined);
});

describe("iniciar una sesión", () => {
  it("registra la geocerca, numera la sesión y deja constancia en el log", async () => {
    const id = await startSession(CENTER, 150);
    expect(id).toBe("S1");
    expect(Location.startGeofencingAsync).toHaveBeenCalledWith(SPIKE_GEOFENCE_TASK, [
      { identifier: "spike-region", ...CENTER, radius: 150, notifyOnEnter: true, notifyOnExit: true },
    ]);
    expect(readConfig()).toMatchObject({ session: "S1", sessionSeq: 1, geofenceActive: true, radius: 150, center: CENTER });
    expect(readConfig().sessionStartedAt).toBe(Date.now());
    expect(kinds()).toEqual(["session_start", "register"]);
    expect(readLog()[0]).toMatchObject({ session: "S1", radius: 150, batteryCheckOverridden: false, batteryOptimization: true });
  });

  it("las coordenadas del log se redondean a ~110 m (no ubican a la persona)", async () => {
    await startSession(CENTER, 100);
    expect(readLog()[0]).toMatchObject({ center: { latitude: 19.428, longitude: -99.168 } });
  });

  it("tras terminar una sesión la siguiente es S2", async () => {
    await startSession(CENTER, 100);
    await endSession("manual");
    expect(await startSession(CENTER, 100)).toBe("S2");
  });

  it("no deja iniciar otra sesión con una en curso", async () => {
    await startSession(CENTER, 100);
    await expect(startSession(CENTER, 100)).rejects.toThrow(/Ya hay una sesión en curso/);
    expect(Location.startGeofencingAsync).toHaveBeenCalledTimes(1);
  });

  it("sin «Permitir todo el tiempo» NO inicia ni escribe nada", async () => {
    vi.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue({ status: "denied", granted: false } as never);
    await expect(startSession(CENTER, 100)).rejects.toThrow(/Permitir todo el tiempo/);
    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(readConfig()).toMatchObject({ session: null, sessionSeq: 0, geofenceActive: false });
    expect(readLog()).toEqual([]);
  });

  it("perfil «sin restricciones» con la optimización activa BLOQUEA (el caso real del 2026-10-05)", async () => {
    writeConfig({ batteryProfile: "unrestricted" });
    await expect(startSession(CENTER, 100)).rejects.toThrow(/Sin restricciones/);
    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(readLog()).toEqual([]);
  });

  it("…y solo se salta con la confirmación explícita, dejando la sesión marcada como forzada", async () => {
    writeConfig({ batteryProfile: "unrestricted" });
    await startSession(CENTER, 100, { overrideBatteryCheck: true });
    expect(readLog()[0]).toMatchObject({ kind: "session_start", batteryCheckOverridden: true, batteryOptimization: true });
  });

  it("forzar la batería no salta un bloqueo de permisos", async () => {
    writeConfig({ batteryProfile: "unrestricted" });
    vi.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue({ status: "denied", granted: false } as never);
    await expect(startSession(CENTER, 100, { overrideBatteryCheck: true })).rejects.toThrow(/Permitir todo el tiempo/);
  });

  it("si Android rechaza el registro, la sesión se revierte y queda el motivo en el log", async () => {
    vi.mocked(Location.startGeofencingAsync).mockRejectedValueOnce(new Error("Geofencing not available."));
    await expect(startSession(CENTER, 100)).rejects.toThrow("Geofencing not available.");
    expect(readConfig()).toMatchObject({ session: null, sessionStartedAt: null, geofenceActive: false });
    expect(readLog().map((e) => [e.kind, (e as { reason?: string }).reason])).toEqual([
      ["session_start", undefined],
      ["session_end", "register_failed"],
    ]);
  });
});

describe("terminar una sesión", () => {
  it("quita la geocerca, cierra la sesión y limpia la configuración", async () => {
    await startSession(CENTER, 100);
    vi.mocked(Location.hasStartedGeofencingAsync).mockResolvedValue(true);
    await endSession("manual");
    expect(Location.stopGeofencingAsync).toHaveBeenCalledWith(SPIKE_GEOFENCE_TASK);
    expect(readConfig()).toMatchObject({ session: null, sessionStartedAt: null, geofenceActive: false });
    expect(readLog().at(-1)).toMatchObject({ kind: "session_end", session: "S1", reason: "manual" });
  });

  it("sin sesión no escribe un session_end huérfano", async () => {
    await endSession("manual");
    expect(readLog()).toEqual([]);
  });
});

describe("al abrir la app", () => {
  it("registra el estado una sola vez aunque el panel y el efecto lo pidan casi a la vez", async () => {
    await checkRegistration();
    vi.setSystemTime(Date.now() + 150);
    await checkRegistration();
    expect(kinds().filter((k) => k === "app_open")).toHaveLength(1);
    vi.setSystemTime(Date.now() + 5000);
    await checkRegistration();
    expect(kinds().filter((k) => k === "app_open")).toHaveLength(2);
  });

  it("si el sistema borró la geocerca, cierra la sesión como «missing» y lo avisa", async () => {
    await startSession(CENTER, 100);
    vi.mocked(Location.hasStartedGeofencingAsync).mockResolvedValue(false); // desapareció (reinicio, etc.)
    vi.setSystemTime(Date.now() + 60_000);
    expect(await checkRegistration()).toEqual({ missing: true });
    expect(kinds()).toContain("geofence_missing");
    expect(readLog().at(-1)).toMatchObject({ kind: "session_end", session: "S1", reason: "missing" });
    expect(readConfig()).toMatchObject({ session: null, geofenceActive: false });
  });

  it("con la geocerca viva no toca nada", async () => {
    await startSession(CENTER, 100);
    vi.mocked(Location.hasStartedGeofencingAsync).mockResolvedValue(true);
    vi.setSystemTime(Date.now() + 60_000);
    expect(await checkRegistration()).toEqual({ missing: false });
    expect(readConfig().session).toBe("S1");
    expect(kinds()).not.toContain("geofence_missing");
  });

  it("migra la geocerca de una versión anterior a las sesiones: la retira sin dejar sesión huérfana", async () => {
    writeConfig({ geofenceActive: true, session: null });
    vi.mocked(Location.hasStartedGeofencingAsync).mockResolvedValue(true);
    expect(await checkRegistration()).toEqual({ missing: false });
    expect(Location.stopGeofencingAsync).toHaveBeenCalled();
    expect(readConfig().geofenceActive).toBe(false);
    expect(readLog().at(-1)).toMatchObject({ kind: "config" });
  });
});

describe("atajos a ajustes del sistema", () => {
  it("la exclusión de batería abre el diálogo del sistema con el paquete de la app", async () => {
    await requestBatteryExemption();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", { data: "package:com.cliche.geocheck" });
  });

  it("si el diálogo no existe cae a la lista de optimización", async () => {
    vi.mocked(IntentLauncher.startActivityAsync).mockRejectedValueOnce(new Error("no activity"));
    await requestBatteryExemption();
    expect(vi.mocked(IntentLauncher.startActivityAsync).mock.calls.map((c) => c[0])).toEqual([
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
    ]);
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it("si ningún intent de Xiaomi existe cae a los ajustes de la app (no se queda mudo)", async () => {
    vi.mocked(IntentLauncher.startActivityAsync).mockRejectedValue(new Error("no activity"));
    expect(await openMiuiAutostart()).toBe(false);
    expect(Linking.openSettings).toHaveBeenCalled();
    vi.mocked(IntentLauncher.startActivityAsync).mockResolvedValue({ resultCode: 0 } as never);
  });
});
