// Registro de geofences en segundo plano usando Expo Location + TaskManager.
// Cubre RF-03 (clock-in automático), RF-04 (clock-out automático),
// RF-16 (tracking en background) y RNF-01 (bajo consumo de batería,
// usando geofencing nativo del SO en vez de polling GPS constante).

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { api } from "./api";

export const GEOFENCE_TASK = "PROJECT_GEOFENCE_TASK";

interface ActiveProject {
  id: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
}

TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }: any) => {
  if (error) {
    console.error("Error en tarea de geofence:", error);
    return;
  }
  if (data) {
    const { eventType, region } = data;
    if (eventType === Location.GeofencingEventType.Enter) {
      // RF-03: clock-in automático
      api.post("/time-entries/clock-in", {
        projectId: region.identifier,
        type: "AUTO",
      }).catch((e) => console.error("Error en clock-in automático:", e));
    } else if (eventType === Location.GeofencingEventType.Exit) {
      // RF-04: clock-out automático (requiere buscar la entrada abierta primero)
      api.post(`/time-entries/exit/${region.identifier}`).catch((e) =>
        console.error("Error en clock-out automático:", e)
      );
    }
  }
});

export async function registerProjectGeofences(projects: ActiveProject[]) {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Se requiere permiso de ubicación en segundo plano para el fichaje automático");
  }

  await Location.startGeofencingAsync(
    GEOFENCE_TASK,
    projects.map((p) => ({
      identifier: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: p.geofenceRadius,
      notifyOnEnter: true,
      notifyOnExit: true,
    }))
  );
}

export async function stopProjectGeofences() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}
