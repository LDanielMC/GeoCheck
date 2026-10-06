// Spike de geofencing — operaciones del laboratorio: permisos, sesiones, estado y atajos a ajustes del sistema.

import { Linking } from "react-native";
import * as Battery from "expo-battery";
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { SPIKE_GEOFENCE_TASK } from "./geofenceTask";
import { notificationPermission, requestNotificationPermission } from "./labNotifications";
import { canStart, preflight, type Preflight, type PreflightInput } from "./preflight";
import { appendLog, readConfig, REGION_ID, writeConfig, type SpikeConfig } from "./spikeStorage";

const PACKAGE = Constants.expoConfig?.android?.package ?? "com.cliche.geocheck";

export interface LabStatus {
  foreground: string;
  foregroundAccuracy: string; // "fine" = ubicación precisa; "coarse" = aproximada
  background: string;
  servicesEnabled: boolean;
  notifications: string;
  registered: boolean;
  taskDefined: boolean;
  batteryOptimization: boolean | null; // true = Android puede restringir la app (lista blanca de Doze)
  lowPowerMode: boolean | null;
  providers: { gps?: boolean; network?: boolean; passive?: boolean } | null;
}

export async function getStatus(): Promise<LabStatus> {
  const [fg, bg, servicesEnabled, notifications, registered, batteryOptimization, lowPowerMode, providers] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    notificationPermission().catch(() => "unknown"),
    Location.hasStartedGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => false),
    Battery.isBatteryOptimizationEnabledAsync().catch(() => null),
    Battery.isLowPowerModeEnabledAsync().catch(() => null),
    Location.getProviderStatusAsync()
      .then((p) => ({ gps: p.gpsAvailable, network: p.networkAvailable, passive: p.passiveAvailable }))
      .catch(() => null),
  ]);
  return {
    foreground: fg.status,
    foregroundAccuracy: fg.android?.accuracy ?? "—",
    background: bg.status,
    servicesEnabled,
    notifications,
    registered,
    taskDefined: TaskManager.isTaskDefined(SPIKE_GEOFENCE_TASK),
    batteryOptimization,
    lowPowerMode,
    providers,
  };
}

export const preflightInput = (config: SpikeConfig, status: LabStatus): PreflightInput => ({
  scenario: config.scenario,
  batteryProfile: config.batteryProfile,
  foreground: status.foreground,
  foregroundAccuracy: status.foregroundAccuracy,
  background: status.background,
  servicesEnabled: status.servicesEnabled,
  batteryOptimization: status.batteryOptimization,
  lowPowerMode: status.lowPowerMode,
  notifications: status.notifications,
});

export const runPreflight = (config: SpikeConfig, status: LabStatus): Preflight => preflight(preflightInput(config, status));

// Android 11+: primero el permiso en primer plano y después, por separado, "Permitir todo el tiempo".
// También pide el de notificaciones (Android 13+), que hace falta para los avisos de detección.
export async function requestPermissions(): Promise<LabStatus> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.granted) await Location.requestBackgroundPermissionsAsync();
  await requestNotificationPermission().catch(() => undefined);
  const status = await getStatus();
  await appendLog({
    kind: "permission",
    foreground: status.foreground,
    foregroundAccuracy: status.foregroundAccuracy,
    background: status.background,
    notifications: status.notifications,
  });
  return status;
}

export async function currentPosition() {
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy };
}

// Las coordenadas se redondean a ~110 m en el log: sirven para distinguir sesiones, no para ubicarte.
const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

// Inicia una sesión: fija escenario, perfil, centro y radio, y registra la geocerca. `overrideBatteryCheck`
// salta (y deja marcado en el log) un bloqueo de batería que el usuario confirmó como falso.
export async function startSession(center: { latitude: number; longitude: number }, radius: number, opts: { overrideBatteryCheck?: boolean } = {}): Promise<string> {
  const config = readConfig();
  if (config.session) throw new Error("Ya hay una sesión en curso. Termínala antes de empezar otra.");

  const status = await getStatus();
  const check = preflight(preflightInput(config, status));
  if (!canStart(check, opts.overrideBatteryCheck === true)) throw new Error(check.blockers.map((b) => b.message).join("\n"));

  const seq = config.sessionSeq + 1;
  const id = `S${seq}`;
  writeConfig({ session: id, sessionSeq: seq, sessionStartedAt: Date.now(), center, radius, geofenceActive: true });
  await appendLog({
    kind: "session_start",
    session: id,
    radius,
    center: { latitude: roundCoord(center.latitude), longitude: roundCoord(center.longitude) },
    batteryOptimization: status.batteryOptimization,
    batteryCheckOverridden: check.blockers.length > 0,
  });

  try {
    await Location.startGeofencingAsync(SPIKE_GEOFENCE_TASK, [{ identifier: REGION_ID, ...center, radius, notifyOnEnter: true, notifyOnExit: true }]);
  } catch (error) {
    writeConfig({ session: null, sessionStartedAt: null, geofenceActive: false });
    await appendLog({ kind: "session_end", session: id, reason: "register_failed", message: error instanceof Error ? error.message : String(error) });
    throw error;
  }
  await appendLog({ kind: "register", session: id, radius });
  return id;
}

export async function endSession(reason: "manual" | "missing" = "manual") {
  const { session } = readConfig();
  if (await Location.hasStartedGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(SPIKE_GEOFENCE_TASK);
  }
  writeConfig({ session: null, sessionStartedAt: null, geofenceActive: false });
  if (session) await appendLog({ kind: "session_end", session, reason });
}

// El panel y el efecto de abrir la app disparan esto casi a la vez: se registra una sola vez.
let lastAppOpenLoggedAt = 0;

// Al abrir la app: deja constancia del estado y detecta si el sistema borró la geocerca (reinicio, ajuste de
// batería, actualización de Play Services…), que es uno de los hallazgos que busca el spike.
export async function checkRegistration(): Promise<{ missing: boolean }> {
  const config = readConfig();
  const registered = await Location.hasStartedGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => false);
  const status = await getStatus();

  if (Date.now() - lastAppOpenLoggedAt > 3000) {
    lastAppOpenLoggedAt = Date.now();
    await appendLog({
      kind: "app_open",
      registered,
      background: status.background,
      foregroundAccuracy: status.foregroundAccuracy,
      servicesEnabled: status.servicesEnabled,
      notifications: status.notifications,
      batteryOptimization: status.batteryOptimization,
      lowPowerMode: status.lowPowerMode,
      providers: status.providers,
    });
  }

  // Geocerca activa de una versión anterior a las sesiones: sin sesión no se puede analizar, se retira.
  if (config.geofenceActive && !config.session) {
    if (registered) await Location.stopGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => undefined);
    writeConfig({ geofenceActive: false });
    await appendLog({ kind: "config", note: "geocerca anterior a las sesiones retirada" });
    return { missing: false };
  }
  if (config.session && !registered) {
    await appendLog({ kind: "geofence_missing", session: config.session });
    await endSession("missing");
    return { missing: true };
  }
  return { missing: false };
}

// Atajos a ajustes del sistema. Varios son intentos (sobre todo los de Xiaomi/MIUI, que no se pudieron
// verificar): si ninguno abre, se cae a los ajustes generales de la app.
async function launch(attempts: Array<() => Promise<unknown>>): Promise<boolean> {
  for (const attempt of attempts) {
    try {
      await attempt();
      return true;
    } catch {
      // se prueba el siguiente
    }
  }
  await Linking.openSettings();
  return false;
}

const { ActivityAction } = IntentLauncher;

// Diálogo del sistema «¿Permitir que GeoCheck se ejecute siempre en segundo plano?». Es lo que cambia la lista
// blanca de Doze que lee isBatteryOptimizationEnabled. Necesita el permiso REQUEST_IGNORE_BATTERY_OPTIMIZATIONS.
export const requestBatteryExemption = () =>
  launch([
    () => IntentLauncher.startActivityAsync(ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data: `package:${PACKAGE}` }),
    () => IntentLauncher.startActivityAsync(ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
  ]);

export const openBatteryOptimizationList = () => launch([() => IntentLauncher.startActivityAsync(ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS)]);

export const openMiuiBatterySaver = () =>
  launch([
    () =>
      IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
        packageName: "com.miui.powerkeeper",
        className: "com.miui.powerkeeper.ui.HiddenAppsConfigActivity",
        extra: { package_name: PACKAGE, package_label: "GeoCheck" },
      }),
  ]);

export const openMiuiAutostart = () =>
  launch([
    () =>
      IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
        packageName: "com.miui.securitycenter",
        className: "com.miui.permcenter.autostart.AutoStartManagementActivity",
      }),
    () => IntentLauncher.startActivityAsync("miui.intent.action.OP_AUTO_START"),
  ]);

export const openNotificationSettings = () =>
  launch([() => IntentLauncher.startActivityAsync(ActivityAction.APP_NOTIFICATION_SETTINGS, { extra: { "android.provider.extra.APP_PACKAGE": PACKAGE } })]);

export const openAppSettings = () => Linking.openSettings();
