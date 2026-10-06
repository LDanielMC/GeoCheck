import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Battery from "expo-battery";
import { appendLog, clearLog, readConfig, readLog, writeConfig } from "./spikeStorage";
import { resetFs } from "./testing/memoryFs";

beforeEach(() => {
  resetFs();
  vi.useRealTimers();
});

describe("configuración", () => {
  it("sin archivo devuelve los valores por defecto", () => {
    expect(readConfig()).toMatchObject({ session: null, sessionSeq: 0, scenario: "1", batteryProfile: "default", geofenceActive: false, livePanel: true, vibrateOnDetect: true });
  });

  it("writeConfig mezcla con lo guardado y los archivos viejos reciben los campos nuevos por defecto", () => {
    writeConfig({ scenario: "3", radius: 100 });
    writeConfig({ batteryProfile: "unrestricted" });
    expect(readConfig()).toMatchObject({ scenario: "3", radius: 100, batteryProfile: "unrestricted", session: null });
  });
});

describe("log", () => {
  it("etiqueta cada entrada con hora, batería, escenario, perfil y sesión en curso", async () => {
    writeConfig({ scenario: "3", batteryProfile: "unrestricted", geofenceActive: true, session: "S2" });
    const entry = await appendLog({ kind: "snapshot" });
    expect(entry).toMatchObject({ kind: "snapshot", scenario: "3", batteryProfile: "unrestricted", geofenceActive: true, session: "S2", batteryLevel: 0.8, charging: false });
    expect(Number.isNaN(Date.parse(entry!.t))).toBe(false);
    expect(readLog()).toHaveLength(1);
  });

  it("los campos de la entrada mandan: un cruce capturado después puede ser de otra sesión y sin batería", async () => {
    writeConfig({ scenario: "1", session: "S5" });
    const entry = await appendLog({
      kind: "marker",
      type: "exit",
      t: "2026-10-05T12:00:00.000Z",
      session: "S2",
      scenario: "3",
      batteryLevel: null,
      charging: null,
    });
    expect(entry).toMatchObject({ t: "2026-10-05T12:00:00.000Z", session: "S2", scenario: "3", batteryLevel: null, charging: null });
  });

  it("una entrada sin sesión en curso queda con session null (no undefined): así no se confunde con un log viejo", async () => {
    const entry = await appendLog({ kind: "snapshot" });
    expect(entry).toHaveProperty("session", null);
  });

  it("devuelve null y no revienta si falla la batería o el archivo", async () => {
    vi.mocked(Battery.getBatteryLevelAsync).mockRejectedValueOnce(new Error("sin batería"));
    const entry = await appendLog({ kind: "snapshot" });
    expect(entry).toMatchObject({ batteryLevel: null, charging: null }); // degrada, no pierde la entrada
  });

  it("readLog respeta el orden y se salta una línea truncada por un cierre brusco", async () => {
    await appendLog({ kind: "snapshot", note: "a" });
    await appendLog({ kind: "snapshot", note: "b" });
    // Simula un proceso muerto a media escritura: appendLog escribe primero el salto de línea y luego la entrada.
    const { File, Paths } = await import("expo-file-system");
    new File(Paths.document, "geocheck-spike-log.jsonl").write('\n{"t":"2026-10-05T1', { append: true });
    await appendLog({ kind: "snapshot", note: "c" });
    expect(readLog().map((e) => (e as { note?: string }).note)).toEqual(["a", "b", "c"]);
  });

  it("clearLog borra el log y reinicia el contador de sesiones", async () => {
    writeConfig({ sessionSeq: 7 });
    await appendLog({ kind: "snapshot" });
    clearLog();
    expect(readLog()).toEqual([]);
    expect(readConfig().sessionSeq).toBe(0);
  });
});
