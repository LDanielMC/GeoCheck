import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { fmtClock } from "./analysis";
import { markerNotificationPresent, MARKER_TASK, notifyDetection, postMarkerNotification, setMarkerNotification } from "./labNotifications";
import { appendLog, readConfig, readLog, writeConfig } from "./spikeStorage";
import { resetFs } from "./testing/memoryFs";

// Lo que labNotifications deja registrado al cargarse (clearMocks borra las llamadas antes de cada prueba).
type TaskBody = { data?: unknown; error?: Error | null };
const markerTask = vi.mocked(TaskManager.defineTask).mock.calls.find((c) => c[0] === MARKER_TASK)?.[1] as unknown as ((body: TaskBody) => Promise<void>) | undefined;
const responseListener = vi.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0]?.[0] as unknown as ((response: unknown) => void) | undefined;
const registeredTasks = vi.mocked(Notifications.registerTaskAsync).mock.calls.map((c) => c[0]);
const handlerCalls = vi.mocked(Notifications.setNotificationHandler).mock.calls.length;

const DEFAULT_ACTION = "expo.modules.notifications.actions.DEFAULT";
const press = (notificationId: string, action: string) => ({ actionIdentifier: action, notification: { request: { identifier: notificationId } } });
const markers = () => readLog().filter((e) => e.kind === "marker");
const scheduled = () => vi.mocked(Notifications.scheduleNotificationAsync).mock.calls.map((c) => c[0] as { identifier?: string; content: Record<string, unknown>; trigger: { channelId: string } });

beforeEach(() => {
  resetFs();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
  (AppState as { currentState: string }).currentState = "background";
  writeConfig({ session: "S1", scenario: "3", geofenceActive: true, markerNotification: true, markerNotificationId: "n1" });
});

describe("registro al cargar el módulo", () => {
  it("define la tarea de marcadores, la registra en el sistema y pone el manejador de primer plano", () => {
    expect(markerTask).toBeTypeOf("function");
    expect(registeredTasks).toContain(MARKER_TASK);
    expect(responseListener).toBeTypeOf("function");
    expect(handlerCalls).toBe(1);
  });
});

describe("botones de la notificación fija con la app en segundo plano o cerrada (ruta de la tarea)", () => {
  it("«Salí» registra un marcador de salida sin tocar la app y deja una confirmación que vibra", async () => {
    await markerTask!({ data: press("n1", "spike-exit") });
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toMatchObject({ type: "exit", via: "notification", source: "task", session: "S1", notificationKey: "n1|spike-exit" });
    const confirm = scheduled().find((s) => s.identifier === "geocheck-spike-confirm")!;
    expect(confirm.content.title).toContain("SALIDA marcada");
    expect(confirm.trigger.channelId).toBe("geocheck-spike-confirm-v1");
  });

  it("marca si la app estaba cerrada (el proceso lo arrancó el botón)", async () => {
    await markerTask!({ data: press("n1", "spike-exit") });
    expect(markers()[0]).toHaveProperty("cold");
    expect(typeof (markers()[0] as unknown as { jsUptimeMs: number }).jsUptimeMs).toBe("number");
  });

  it("tras cada pulsación vuelve a publicar la notificación fija con un id nuevo y retira la anterior", async () => {
    await markerTask!({ data: press("n1", "spike-exit") });
    const sticky = scheduled().find((s) => s.identifier?.startsWith("geocheck-spike-marker-"))!;
    expect(sticky.content).toMatchObject({ sticky: true, autoDismiss: false, categoryIdentifier: "geocheck-spike-marker" });
    expect(sticky.content.body).toContain("Último marcador: SALIDA");
    expect(readConfig().markerNotificationId).toBe(sticky.identifier);
    expect(sticky.identifier).not.toBe("n1");
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith("n1");
  });

  it("tocar el cuerpo de la notificación (acción por defecto) no marca nada", async () => {
    await markerTask!({ data: press("n1", DEFAULT_ACTION) });
    expect(markers()).toHaveLength(0);
    expect(scheduled()).toHaveLength(0);
  });

  it("un payload que no es una respuesta (push de datos) se ignora", async () => {
    await markerTask!({ data: { notification: null, data: {} } });
    expect(markers()).toHaveLength(0);
  });

  it("un error de la tarea queda en el log", async () => {
    await markerTask!({ error: new Error("boom") });
    expect(readLog().at(-1)).toMatchObject({ kind: "error", where: "marker_task", message: "boom" });
  });

  it("si falla la notificación de confirmación el marcador NO se pierde", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockRejectedValue(new Error("canal bloqueado"));
    await markerTask!({ data: press("n1", "spike-enter") });
    expect(markers()).toHaveLength(1);
    expect(readLog().some((e) => e.kind === "error" && (e as { where?: string }).where === "marker_notification")).toBe(true);
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("id");
  });
});

describe("la misma pulsación nunca cuenta dos veces", () => {
  it("si llega por la tarea y por el listener (primer plano) se registra una sola vez", async () => {
    (AppState as { currentState: string }).currentState = "active";
    await markerTask!({ data: press("n1", "spike-exit") });
    responseListener!(press("n1", "spike-exit"));
    await vi.runAllTimersAsync();
    expect(markers()).toHaveLength(1);
  });

  it("el listener ignora las respuestas cuando la app NO está en primer plano (las atiende la tarea)", async () => {
    (AppState as { currentState: string }).currentState = "background";
    responseListener!(press("n1", "spike-exit"));
    await vi.runAllTimersAsync();
    expect(markers()).toHaveLength(0);
  });

  it("el listener sí registra en primer plano", async () => {
    (AppState as { currentState: string }).currentState = "active";
    responseListener!(press("n1", "spike-enter"));
    await vi.runAllTimersAsync();
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toMatchObject({ type: "enter", source: "listener" });
  });

  it("una respuesta rezagada de una pulsación ya procesada (marcador fantasma al abrir la app) se descarta", async () => {
    await markerTask!({ data: press("n1", "spike-exit") });
    vi.setSystemTime(Date.now() + 10 * 60_000); // el usuario abre la app 10 min después
    (AppState as { currentState: string }).currentState = "active";
    responseListener!(press("n1", "spike-exit"));
    await vi.runAllTimersAsync();
    expect(markers()).toHaveLength(1);
  });

  it("dos toques del mismo botón en menos de 2 s, aunque sean de instancias distintas, cuentan como uno", async () => {
    await markerTask!({ data: press("n1", "spike-exit") });
    vi.setSystemTime(Date.now() + 1000);
    await markerTask!({ data: press("n2", "spike-exit") });
    expect(markers()).toHaveLength(1);
    vi.setSystemTime(Date.now() + 5000);
    await markerTask!({ data: press("n3", "spike-exit") });
    expect(markers()).toHaveLength(2);
  });

  it("«Entré» y «Salí» sobre la misma notificación son dos marcadores válidos; repetir el mismo botón sobre ella no", async () => {
    await markerTask!({ data: press("n1", "spike-exit") });
    vi.setSystemTime(Date.now() + 60_000);
    await markerTask!({ data: press("n1", "spike-enter") });
    vi.setSystemTime(Date.now() + 60_000);
    await markerTask!({ data: press("n1", "spike-exit") }); // misma notificación y botón: ya procesado
    expect(markers().map((m) => (m as { type: string }).type)).toEqual(["exit", "enter"]);
  });
});

describe("la notificación fija", () => {
  it("sus botones NO abren la app (opensAppToForeground: false): es lo que permite marcar sin contaminar", async () => {
    await postMarkerNotification();
    const [categoryId, actions] = vi.mocked(Notifications.setNotificationCategoryAsync).mock.calls[0];
    expect(categoryId).toBe("geocheck-spike-marker");
    expect(actions.map((a) => [a.identifier, a.buttonTitle, a.options?.opensAppToForeground])).toEqual([
      ["spike-enter", "Entré", false],
      ["spike-exit", "Salí", false],
    ]);
  });

  it("usa canales distintos: la fija es silenciosa y el aviso de detección vibra con importancia alta", async () => {
    await postMarkerNotification();
    const channels = Object.fromEntries(vi.mocked(Notifications.setNotificationChannelAsync).mock.calls.map(([id, cfg]) => [id, cfg]));
    expect(channels["geocheck-spike-marker-v1"]).toMatchObject({ importance: 4, enableVibrate: false, sound: null });
    expect(channels["geocheck-spike-detect-v1"]).toMatchObject({ importance: 6, enableVibrate: true, sound: null });
    expect((channels["geocheck-spike-detect-v1"] as { vibrationPattern: number[] }).vibrationPattern.length).toBeGreaterThan(2);
    expect(channels["geocheck-spike-detect-silent-v1"]).toMatchObject({ enableVibrate: false });
  });

  it("activarla publica la notificación, guarda su id y lo deja en el log; apagarla la retira", async () => {
    writeConfig({ markerNotification: false, markerNotificationId: null });
    await setMarkerNotification(true);
    const id = readConfig().markerNotificationId;
    expect(readConfig().markerNotification).toBe(true);
    expect(id).toMatch(/^geocheck-spike-marker-/);
    expect(scheduled().at(-1)?.content.body).toContain("Pulsa «Salí» o «Entré»");

    await setMarkerNotification(false);
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(id);
    expect(readConfig()).toMatchObject({ markerNotification: false, markerNotificationId: null });
    expect(readLog().filter((e) => e.kind === "marker_notification").map((e) => (e as { enabled?: boolean }).enabled)).toEqual([true, false]);
  });

  it("markerNotificationPresent distingue si sigue en la bandeja (un reinicio o MIUI la quitan)", async () => {
    vi.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValueOnce([{ request: { identifier: "n1" } }] as never);
    expect(await markerNotificationPresent()).toBe(true);
    vi.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValueOnce([] as never);
    expect(await markerNotificationPresent()).toBe(false);
    writeConfig({ markerNotificationId: null });
    expect(await markerNotificationPresent()).toBe(false);
  });
});

describe("aviso con vibración al detectar un evento", () => {
  const eventT = "2026-10-10T15:05:30.000Z";

  it("una salida normal: título con tipo y hora, canal que vibra", async () => {
    await notifyDetection({ type: "exit", eventT, initial: false, restored: false, cold: true, scenario: "3" });
    const n = scheduled().at(-1)!;
    expect(n.content.title).toBe(`SALIDA detectada · ${fmtClock(eventT)}`);
    expect(n.content.body).toContain("Esc. 3");
    expect(n.content.body).toContain("app en frío");
    expect(n.trigger.channelId).toBe("geocheck-spike-detect-v1");
  });

  it("el evento inicial tras registrar se explica y no se hace pasar por un cruce", async () => {
    await notifyDetection({ type: "enter", eventT, initial: true, restored: false, cold: false, scenario: "3" });
    const n = scheduled().at(-1)!;
    expect(n.content.title).toContain("Geocerca registrada");
    expect(n.content.title).toContain("DENTRO");
    expect(n.content.body).toContain("estado inicial, no es un cruce");
  });

  it("al abrir la app desde cero avisa del estado pero NO lo hace pasar por una detección", async () => {
    await notifyDetection({ type: "exit", eventT, initial: false, restored: true, cold: true, scenario: "3" });
    const n = scheduled().at(-1)!;
    expect(n.content.title).toBe(`Al abrir la app el sistema te ve FUERA · ${fmtClock(eventT)}`);
    expect(n.content.title).not.toContain("detectada");
    expect(n.content.body).toContain("no es una detección");
  });

  it("con un marcador esperando, dice en el campo cuánto tardó el sistema", async () => {
    await appendLog({ kind: "session_start", session: "S1", t: "2026-10-10T15:00:00.000Z", radius: 100 });
    await appendLog({ kind: "marker", type: "exit", id: "m1", t: "2026-10-10T15:05:00.000Z" });
    await appendLog({ kind: "geofence", type: "exit", t: eventT, appState: "background", jsUptimeMs: 900, cold: true, initial: false });
    await notifyDetection({ type: "exit", eventT, initial: false, restored: false, cold: true, scenario: "3" });
    expect(scheduled().at(-1)?.content.body).toContain("+30 s tras tu marcador de las");
  });

  it("sin marcador no inventa una latencia", async () => {
    await appendLog({ kind: "session_start", session: "S1", t: "2026-10-10T15:00:00.000Z", radius: 100 });
    await appendLog({ kind: "geofence", type: "exit", t: eventT, appState: "background", jsUptimeMs: 900, cold: true, initial: false });
    await notifyDetection({ type: "exit", eventT, initial: false, restored: false, cold: false, scenario: "3" });
    expect(scheduled().at(-1)?.content.body).not.toContain("tras tu marcador");
  });

  it("con «vibrar» apagado (p. ej. la prueba de la noche) usa el canal silencioso", async () => {
    writeConfig({ vibrateOnDetect: false });
    await notifyDetection({ type: "exit", eventT, initial: false, restored: false, cold: true, scenario: "6" });
    expect(scheduled().at(-1)?.trigger.channelId).toBe("geocheck-spike-detect-silent-v1");
  });

  it("si Android rechaza la notificación (permiso denegado) el error queda en el log y no revienta la tarea", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockRejectedValueOnce(new Error("sin permiso"));
    await expect(notifyDetection({ type: "exit", eventT, initial: false, restored: false, cold: true, scenario: "3" })).resolves.toBeUndefined();
    expect(readLog().at(-1)).toMatchObject({ kind: "error", where: "notify_detection", message: "sin permiso" });
  });
});

describe("permiso de notificaciones", () => {
  it("crea los canales ANTES de pedir el permiso (Android 13 no muestra el diálogo si no hay ninguno)", async () => {
    const { requestNotificationPermission } = await import("./labNotifications");
    await requestNotificationPermission();
    const firstChannel = Math.min(...vi.mocked(Notifications.setNotificationChannelAsync).mock.invocationCallOrder);
    const request = vi.mocked(Notifications.requestPermissionsAsync).mock.invocationCallOrder[0];
    expect(firstChannel).toBeLessThan(request);
  });

  it("devuelve granted o el estado que informe el sistema", async () => {
    const { requestNotificationPermission } = await import("./labNotifications");
    expect(await requestNotificationPermission()).toBe("granted");
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({ granted: false, status: "denied" } as never);
    expect(await requestNotificationPermission()).toBe("denied");
  });
});
