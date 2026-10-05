// Spike de geofencing — operaciones del laboratorio: permisos, registro de la geocerca y estado.

import { Linking } from "react-native";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { SPIKE_GEOFENCE_TASK } from "./geofenceTask";
import { appendLog, readConfig, REGION_ID, writeConfig } from "./spikeStorage";

export interface LabStatus {
  foreground: string;
  foregroundAccuracy: string; // "fine" = ubicación precisa; "coarse" = aproximada
  background: string;
  servicesEnabled: boolean;
  registered: boolean;
  taskDefined: boolean;
  batteryOptimization: boolean | null; // true = el sistema puede restringir la app
  lowPowerMode: boolean | null;
}

export async function getStatus(): Promise<LabStatus> {
  const [fg, bg, servicesEnabled, registered, batteryOptimization, lowPowerMode] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    Location.hasStartedGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => false),
    Battery.isBatteryOptimizationEnabledAsync().catch(() => null),
    Battery.isLowPowerModeEnabledAsync().catch(() => null),
  ]);
  return {
    foreground: fg.status,
    foregroundAccuracy: fg.android?.accuracy ?? "—",
    background: bg.status,
    servicesEnabled,
    registered,
    taskDefined: TaskManager.isTaskDefined(SPIKE_GEOFENCE_TASK),
    batteryOptimization,
    lowPowerMode,
  };
}

// Android 11+: primero el permiso en primer plano y después, por separado, "Permitir todo el tiempo".
export async function requestPermissions(): Promise<LabStatus> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.granted) await Location.requestBackgroundPermissionsAsync();
  const status = await getStatus();
  await appendLog({
    kind: "permission",
    foreground: status.foreground,
    foregroundAccuracy: status.foregroundAccuracy,
    background: status.background,
  });
  return status;
}

export async function currentPosition() {
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy };
}

export async function registerGeofence(center: { latitude: number; longitude: number }, radius: number) {
  const status = await getStatus();
  if (status.background !== "granted") {
    throw new Error('Falta el permiso de ubicación "Permitir todo el tiempo".');
  }
  await Location.startGeofencingAsync(SPIKE_GEOFENCE_TASK, [
    { identifier: REGION_ID, ...center, radius, notifyOnEnter: true, notifyOnExit: true },
  ]);
  writeConfig({ center, radius, geofenceActive: true });
  await appendLog({ kind: "register", radius, ...center });
}

export async function unregisterGeofence() {
  if (await Location.hasStartedGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(SPIKE_GEOFENCE_TASK);
  }
  writeConfig({ geofenceActive: false });
  await appendLog({ kind: "unregister" });
}

// Al abrir la app: si debería haber una geocerca activa pero el sistema ya no la tiene (reinicio, ajuste de
// batería, actualización de Play Services…), se deja constancia: es uno de los hallazgos que busca el spike.
export async function checkRegistration(): Promise<{ missing: boolean }> {
  const config = readConfig();
  const registered = await Location.hasStartedGeofencingAsync(SPIKE_GEOFENCE_TASK).catch(() => false);
  const status = await getStatus();
  await appendLog({
    kind: "app_open",
    registered,
    background: status.background,
    foregroundAccuracy: status.foregroundAccuracy,
    servicesEnabled: status.servicesEnabled,
    batteryOptimization: status.batteryOptimization,
    lowPowerMode: status.lowPowerMode,
  });
  if (config.geofenceActive && !registered) {
    await appendLog({ kind: "geofence_missing" });
    writeConfig({ geofenceActive: false });
    return { missing: true };
  }
  return { missing: false };
}

// Atajos a ajustes del sistema. Los de Xiaomi/MIUI son intentos: si el intent no existe en esta versión
// caemos a los ajustes generales de la app.
async function openIntent(action: string) {
  try {
    await Linking.sendIntent(action);
  } catch {
    await Linking.openSettings();
  }
}

export const openAppSettings = () => Linking.openSettings();
export const openBatteryOptimizationSettings = () => openIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
export const openMiuiAutostart = () => openIntent("miui.intent.action.OP_AUTO_START");
