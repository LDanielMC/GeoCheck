// Spike de geofencing — tarea que el sistema ejecuta al detectar entrada/salida de la geocerca.
//
// IMPORTANTE: TaskManager.defineTask debe ejecutarse al cargar el módulo (alcance global), no dentro de un
// componente. Por eso App.tsx importa este archivo (vía register.ts): cuando el sistema despierta la app cerrada
// solo carga el bundle de JS (sin montar la UI) y necesita encontrar la tarea ya definida.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { INITIAL_TRIGGER_WINDOW_MS, type CrossingType } from "./analysis";
import { notifyDetection } from "./labNotifications";
import { appendLog, COLD_START_THRESHOLD_MS, currentAppState, JS_LOADED_AT, readConfig, runtime } from "./spikeStorage";

export const SPIKE_GEOFENCE_TASK = "GEOCHECK_SPIKE_GEOFENCE";

// Última posición conocida: no enciende el GPS (no altera la medición de batería) y dice qué tan buena era.
async function lastFix() {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const fix = await Promise.race([Location.getLastKnownPositionAsync(), timeout]);
    if (!fix) return { lastFixAccuracyM: null, lastFixAgeS: null };
    return { lastFixAccuracyM: fix.coords.accuracy ?? null, lastFixAgeS: Math.round((Date.now() - fix.timestamp) / 1000) };
  } catch {
    return { lastFixAccuracyM: null, lastFixAgeS: null };
  }
}

TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
  SPIKE_GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error) {
      await appendLog({ kind: "error", where: "geofence_task", message: error.message });
      return;
    }
    if (!data) return;

    const type: CrossingType = data.eventType === Location.GeofencingEventType.Enter ? "enter" : "exit";
    const jsUptimeMs = Date.now() - JS_LOADED_AT;
    const { sessionStartedAt, scenario } = readConfig();
    const appState = currentAppState();
    const cold = jsUptimeMs < COLD_START_THRESHOLD_MS;
    // Expo registra la geocerca con INITIAL_TRIGGER_ENTER | INITIAL_TRIGGER_EXIT: al registrarla Android informa el
    // estado actual casi al instante (ENTER si estás dentro, EXIT si estás fuera). No es un cruce.
    const sinceStart = sessionStartedAt == null ? null : Date.now() - sessionStartedAt;
    const initial = sinceStart != null && sinceStart >= 0 && sinceStart <= INITIAL_TRIGGER_WINDOW_MS;
    // Lo mismo ocurre cada vez que arranca un proceso nuevo de la app (Expo restaura y vuelve a registrar las
    // tareas): si el JS acaba de cargarse y la app está en primer plano, es casi seguro que abriste la app tú.
    const restored = !initial && cold && appState === "active";

    const entry = await appendLog({
      kind: "geofence",
      type,
      regionState: data.region.state != null ? Location.GeofencingRegionState[data.region.state] : undefined,
      appState,
      jsUptimeMs,
      cold,
      initial,
      restored,
      liveWatch: runtime.liveWatch,
      ...(await lastFix()),
    });
    await notifyDetection({ type, eventT: entry?.t ?? new Date().toISOString(), initial, restored, cold, scenario });
  }
);
