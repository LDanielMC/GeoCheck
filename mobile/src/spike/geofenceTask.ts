// Spike de geofencing — tarea que el sistema ejecuta al detectar entrada/salida de la geocerca.
//
// IMPORTANTE: TaskManager.defineTask debe ejecutarse al cargar el módulo (alcance global), no dentro de un
// componente. Por eso App.tsx importa este archivo directamente: cuando el sistema despierta la app cerrada,
// solo carga el bundle de JS (sin montar la UI) y necesita encontrar la tarea ya definida.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import type { CrossingType } from "./analysis";
import { appendLog, currentAppState, JS_LOADED_AT } from "./spikeStorage";

export const SPIKE_GEOFENCE_TASK = "GEOCHECK_SPIKE_GEOFENCE";

// Si el JS lleva menos de esto cargado cuando llega el evento, la app estaba cerrada ("en frío").
const COLD_START_THRESHOLD_MS = 15_000;

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
    await appendLog({
      kind: "geofence",
      type,
      regionState: data.region.state != null ? Location.GeofencingRegionState[data.region.state] : undefined,
      appState: currentAppState(),
      jsUptimeMs,
      cold: jsUptimeMs < COLD_START_THRESHOLD_MS,
      ...(await lastFix()),
    });
  }
);
