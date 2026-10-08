// Spike de geofencing — notificaciones locales del laboratorio.
//
//  1. Aviso con vibración cada vez que la tarea en segundo plano registra un Enter/Exit: así sabes EN EL CAMPO
//     que el sistema ya detectó el cruce, sin abrir la app.
//  2. Notificación fija con botones «Entré» / «Salí» para marcar el cruce SIN abrir la app. Abrirla contamina los
//     escenarios 2 a 4 (la app dejaría de estar cerrada o en segundo plano).
//
// Cómo funcionan los botones (expo-notifications, Android): con `opensAppToForeground: false` el botón dispara un
// broadcast, no una Activity. Si la app no está en primer plano la librería ejecuta las tareas registradas con
// `Notifications.registerTaskAsync` en un runtime headless (también con el proceso muerto) y les pasa la respuesta.
// Los listeners de JS NO se disparan si el proceso está muerto, por eso la ruta real es la tarea; el listener solo
// cubre el primer plano. Para no contar un toque dos veces (o que una respuesta rezagada se convierta en un
// marcador fantasma al abrir la app) cada pulsación se identifica por notificación+botón y se descarta si ya
// está en el log; tras cada pulsación la notificación se vuelve a publicar con un id nuevo.

import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { fmtClock, fmtS, lastActiveMarker, summarize, type CrossingType } from "./analysis";
import { appendLog, COLD_START_THRESHOLD_MS, JS_LOADED_AT, newMarkerId, readConfig, readLog, writeConfig } from "./spikeStorage";

// Solo el build del spike (o el desarrollo con EXPO_PUBLIC_SPIKE=1) toca notificaciones.
const SPIKE_MODE = process.env.EXPO_PUBLIC_SPIKE === "1";

export const MARKER_TASK = "GEOCHECK_SPIKE_MARKER_TASK";
// Los canales de Android no se pueden modificar una vez creados: si cambia su configuración, sube el sufijo.
const CHANNEL_DETECT = "geocheck-spike-detect-v1";
const CHANNEL_DETECT_SILENT = "geocheck-spike-detect-silent-v1";
const CHANNEL_MARKER = "geocheck-spike-marker-v1";
const CHANNEL_CONFIRM = "geocheck-spike-confirm-v1";
const CATEGORY_MARKER = "geocheck-spike-marker";
const ACTION_ENTER = "spike-enter";
const ACTION_EXIT = "spike-exit";
const CONFIRM_ID = "geocheck-spike-confirm";
// Dos toques del mismo botón en menos de esto se entienden como uno solo.
const DOUBLE_TAP_MS = 2000;

const typeLabel = (type: CrossingType) => (type === "enter" ? "ENTRADA" : "SALIDA");

async function ensureChannels() {
  const { AndroidImportance, AndroidNotificationVisibility } = Notifications;
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNEL_DETECT, {
      name: "Detección de cruces (vibra)",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      enableVibrate: true,
      sound: null,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_DETECT_SILENT, {
      name: "Detección de cruces (silenciosa)",
      importance: AndroidImportance.LOW,
      enableVibrate: false,
      sound: null,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_MARKER, {
      name: "Marcar cruces (fija)",
      importance: AndroidImportance.LOW,
      enableVibrate: false,
      sound: null,
      showBadge: false,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_CONFIRM, {
      name: "Confirmación de marcador (vibra una vez)",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
      enableVibrate: true,
      sound: null,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    }),
  ]);
}

async function ensureCategory() {
  await Notifications.setNotificationCategoryAsync(CATEGORY_MARKER, [
    { identifier: ACTION_ENTER, buttonTitle: "Entré", options: { opensAppToForeground: false } },
    { identifier: ACTION_EXIT, buttonTitle: "Salí", options: { opensAppToForeground: false } },
  ]);
}

export async function notificationPermission(): Promise<string> {
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.granted ? "granted" : permissions.status;
}

export async function requestNotificationPermission(): Promise<string> {
  // Android 13+: el diálogo de permiso solo aparece si la app ya creó al menos un canal de notificaciones.
  await ensureChannels();
  const permissions = await Notifications.requestPermissionsAsync();
  return permissions.granted ? "granted" : permissions.status;
}

// ¿Cuánto tardó el sistema en detectar este evento respecto a tu marcador? Es solo una pista inmediata para el
// campo; el análisis final usa el log completo.
function latencyHint(eventT: string): string | null {
  const result = summarize(readLog()).markerResults.find((r) => r.eventAt === eventT);
  return result?.latencyS != null ? `+${fmtS(result.latencyS)} tras tu marcador de las ${fmtClock(result.markerAt)}` : null;
}

// Aviso de detección. Se llama desde la tarea de geocerca justo después de escribir el evento en el log.
export async function notifyDetection(info: { type: CrossingType; eventT: string; initial: boolean; restored: boolean; cold: boolean; scenario: string }) {
  try {
    await ensureChannels();
    const when = fmtClock(info.eventT);
    const side = info.type === "enter" ? "DENTRO" : "FUERA";
    // Registrar la geocerca, o abrir la app desde cero (Expo la registra de nuevo), hace que Android informe el estado
    // actual: se avisa igual para que sepas que llegó, pero sin hacerlo pasar por una detección.
    const title = info.initial
      ? `Geocerca registrada: el sistema te ve ${side} · ${when}`
      : info.restored
        ? `Al abrir la app el sistema te ve ${side} · ${when}`
        : `${typeLabel(info.type)} detectada · ${when}`;
    const note = info.initial ? "estado inicial, no es un cruce" : info.restored ? "re-registro al abrir la app: no es una detección" : latencyHint(info.eventT);
    const body = [`Esc. ${info.scenario}`, info.cold ? "app en frío ❄" : null, note].filter(Boolean).join(" · ");
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { channelId: readConfig().vibrateOnDetect ? CHANNEL_DETECT : CHANNEL_DETECT_SILENT },
    });
  } catch (error) {
    await appendLog({ kind: "error", where: "notify_detection", message: error instanceof Error ? error.message : String(error) });
  }
}

function lastMarkerText(): string {
  const last = lastActiveMarker(readLog());
  return last ? `Último marcador: ${typeLabel(last.type)} a las ${fmtClock(last.t)}` : "Pulsa «Salí» o «Entré» al cruzar el borde. No abre la app.";
}

// (Re)publica la notificación fija con un id nuevo y retira la anterior.
export async function postMarkerNotification() {
  await ensureChannels();
  await ensureCategory();
  const identifier = `geocheck-spike-marker-${Date.now()}`;
  const previous = readConfig().markerNotificationId;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: "GeoCheck · marcar cruces", body: lastMarkerText(), categoryIdentifier: CATEGORY_MARKER, sticky: true, autoDismiss: false },
    trigger: { channelId: CHANNEL_MARKER },
  });
  writeConfig({ markerNotificationId: identifier });
  if (previous) await Notifications.dismissNotificationAsync(previous).catch(() => undefined);
}

export async function setMarkerNotification(enabled: boolean) {
  writeConfig({ markerNotification: enabled });
  if (enabled) {
    await postMarkerNotification();
  } else {
    const id = readConfig().markerNotificationId;
    if (id) await Notifications.dismissNotificationAsync(id).catch(() => undefined);
    writeConfig({ markerNotificationId: null });
  }
  await appendLog({ kind: "marker_notification", enabled });
}

// ¿Sigue la notificación fija en la bandeja? Un reinicio, o que MIUI cierre la app "a la fuerza", la quita.
export async function markerNotificationPresent(): Promise<boolean> {
  const id = readConfig().markerNotificationId;
  if (!id) return false;
  try {
    return (await Notifications.getPresentedNotificationsAsync()).some((n) => n.request.identifier === id);
  } catch {
    return false;
  }
}

async function confirmMarker(type: CrossingType, at: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: CONFIRM_ID,
    content: { title: `✓ ${typeLabel(type)} marcada · ${fmtClock(at)}`, body: "Guardado en el log del laboratorio.", autoDismiss: true },
    trigger: { channelId: CHANNEL_CONFIRM },
  });
}

async function handleMarkerResponse(response: Notifications.NotificationResponse, source: "task" | "listener") {
  const action = response.actionIdentifier;
  // Tocar el cuerpo de la notificación solo abre la app: no marca nada.
  if (action !== ACTION_ENTER && action !== ACTION_EXIT) return;
  const type: CrossingType = action === ACTION_ENTER ? "enter" : "exit";

  // La misma pulsación puede llegar por la tarea y por el listener, o rezagada al abrir la app: se descarta.
  const key = `${response.notification.request.identifier}|${action}`;
  const log = readLog();
  if (log.some((e) => e.kind === "marker" && e.notificationKey === key)) return;
  const sameType = [...log].reverse().find((e) => e.kind === "marker" && e.type === type);
  if (sameType && Date.now() - new Date(sameType.t).getTime() < DOUBLE_TAP_MS) return;

  const jsUptimeMs = Date.now() - JS_LOADED_AT;
  const entry = await appendLog({ kind: "marker", type, id: newMarkerId(), via: "notification", notificationKey: key, source, cold: jsUptimeMs < COLD_START_THRESHOLD_MS, jsUptimeMs });
  try {
    await Promise.all([confirmMarker(type, entry?.t ?? new Date().toISOString()), postMarkerNotification()]);
  } catch (error) {
    await appendLog({ kind: "error", where: "marker_notification", message: error instanceof Error ? error.message : String(error) });
  }
}

if (SPIKE_MODE) {
  // En primer plano también se muestran (por defecto Android las oculta si la app está abierta). shouldPlaySound debe
  // ser true: Expo ata la vibración de la notificación a ese flag y con false no vibra con la app abierta (spike-resultado.md).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });

  // La tarea debe definirse en el alcance global del módulo: el sistema carga el bundle sin montar la UI.
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(MARKER_TASK, async ({ data, error }) => {
    if (error) {
      await appendLog({ kind: "error", where: "marker_task", message: error.message });
      return;
    }
    if (data && "actionIdentifier" in data) await handleMarkerResponse(data, "task");
  });
  Notifications.registerTaskAsync(MARKER_TASK).catch((e) => console.warn("spike: no se pudo registrar la tarea de marcadores", e));

  // Solo primer plano: en segundo plano y con la app cerrada responde la tarea (ver arriba).
  Notifications.addNotificationResponseReceivedListener((response) => {
    if (AppState.currentState === "active") void handleMarkerResponse(response, "listener");
  });
}
