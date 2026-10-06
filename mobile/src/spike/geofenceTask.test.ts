import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { SPIKE_GEOFENCE_TASK } from "./geofenceTask";
import { JS_LOADED_AT, readLog, runtime, writeConfig } from "./spikeStorage";
import { resetFs } from "./testing/memoryFs";

// La tarea que el sistema invoca al detectar un cruce, tal como la registró geofenceTask al cargarse.
type Body = { data?: { eventType: number; region: { state?: number } }; error?: Error | null };
const task = vi.mocked(TaskManager.defineTask).mock.calls.find((c) => c[0] === SPIKE_GEOFENCE_TASK)?.[1] as unknown as ((body: Body) => Promise<void>) | undefined;

const ENTER = 1;
const EXIT = 2;
const geofenceEntries = () => readLog().filter((e) => e.kind === "geofence");
const lastNotification = () => vi.mocked(Notifications.scheduleNotificationAsync).mock.calls.at(-1)?.[0] as { content: { title: string; body: string } } | undefined;

beforeEach(() => {
  resetFs();
  vi.useFakeTimers();
  vi.setSystemTime(JS_LOADED_AT + 120_000); // por defecto: la app lleva 2 min viva (no es un arranque en frío)
  runtime.liveWatch = false;
  (AppState as { currentState: string }).currentState = "background";
  writeConfig({ session: "S1", scenario: "3", geofenceActive: true, sessionStartedAt: Date.now() - 60_000 });
});

describe("tarea de geocerca", () => {
  it("se define al cargar el módulo", () => {
    expect(task).toBeTypeOf("function");
  });

  it("una salida normal queda en el log con su contexto y avisa con vibración", async () => {
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({
      type: "exit",
      regionState: "Outside",
      session: "S1",
      scenario: "3",
      initial: false,
      cold: false,
      liveWatch: false,
      lastFixAccuracyM: 12,
    });
    expect(lastNotification()?.content.title).toContain("SALIDA detectada");
  });

  it("un Enter justo después de iniciar la sesión es el evento inicial, no un cruce", async () => {
    writeConfig({ sessionStartedAt: Date.now() - 200 });
    await task!({ data: { eventType: ENTER, region: { state: 1 } } });
    expect(geofenceEntries()[0]).toMatchObject({ type: "enter", regionState: "Inside", initial: true });
    expect(lastNotification()?.content.title).toContain("Geocerca registrada");
  });

  it("un Enter pasados 15 s de la sesión es un cruce real", async () => {
    writeConfig({ sessionStartedAt: Date.now() - 16_000 });
    await task!({ data: { eventType: ENTER, region: { state: 1 } } });
    expect(geofenceEntries()[0]).toMatchObject({ type: "enter", initial: false });
  });

  it("registrar estando FUERA también produce un evento inicial: Expo pide INITIAL_TRIGGER_EXIT además de ENTER", async () => {
    writeConfig({ sessionStartedAt: Date.now() - 200 });
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({ type: "exit", initial: true });
    expect(lastNotification()?.content.title).toContain("Geocerca registrada: el sistema te ve FUERA");
  });

  it("un Exit pasados 15 s de la sesión es un cruce real", async () => {
    await task!({ data: { eventType: EXIT, region: { state: 2 } } }); // la sesión empezó hace 60 s
    expect(geofenceEntries()[0]).toMatchObject({ type: "exit", initial: false });
  });

  it("abrir la app desde cero re-registra la geocerca: el evento sale marcado como re-registro, no como detección", async () => {
    vi.setSystemTime(JS_LOADED_AT + 2000);
    writeConfig({ sessionStartedAt: Date.now() - 600_000 }); // la sesión lleva 10 min
    (AppState as { currentState: string }).currentState = "active"; // la abriste tú
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({ type: "exit", initial: false, restored: true, cold: true, appState: "active" });
    expect(lastNotification()?.content.title).toContain("Al abrir la app el sistema te ve FUERA");
  });

  it("un evento real que despierta la app cerrada (arranque en frío pero en segundo plano) NO es un re-registro", async () => {
    vi.setSystemTime(JS_LOADED_AT + 1500);
    writeConfig({ sessionStartedAt: Date.now() - 600_000 });
    (AppState as { currentState: string }).currentState = "background";
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({ restored: false, cold: true });
    expect(lastNotification()?.content.title).toContain("SALIDA detectada");
  });

  it("un evento con la app ya viva en primer plano (el caso de la primera prueba) tampoco es un re-registro", async () => {
    (AppState as { currentState: string }).currentState = "active"; // la app lleva 2 min viva
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({ restored: false, cold: false, appState: "active" });
  });

  it("marca el arranque en frío cuando el JS acaba de cargarse (la tarea despertó la app)", async () => {
    vi.setSystemTime(JS_LOADED_AT + 1500);
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({ cold: true, jsUptimeMs: 1500 });
    expect(lastNotification()?.content.body).toContain("app en frío");
  });

  it("marca si el panel en vivo estaba pidiendo ubicación (puede acelerar la detección)", async () => {
    runtime.liveWatch = true;
    await task!({ data: { eventType: EXIT, region: { state: 2 } } });
    expect(geofenceEntries()[0]).toMatchObject({ liveWatch: true });
  });

  it("si la última posición no responde en 3 s sigue adelante con campos vacíos", async () => {
    vi.mocked(Location.getLastKnownPositionAsync).mockReturnValueOnce(new Promise(() => undefined));
    const done = task!({ data: { eventType: EXIT, region: { state: 2 } } });
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(geofenceEntries()[0]).toMatchObject({ lastFixAccuracyM: null, lastFixAgeS: null });
  });

  it("un error de la tarea queda en el log y no avisa", async () => {
    await task!({ error: new Error("fallo del sistema") });
    expect(readLog().at(-1)).toMatchObject({ kind: "error", where: "geofence_task", message: "fallo del sistema" });
    expect(geofenceEntries()).toHaveLength(0);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("sin datos no hace nada", async () => {
    await task!({});
    expect(readLog()).toEqual([]);
  });
});
