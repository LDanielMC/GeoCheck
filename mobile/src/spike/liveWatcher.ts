// Spike de geofencing — seguimiento de ubicación en vivo para el panel (solo con la app abierta).
//
// OJO, contamina la medición: mientras corre, la app PIDE ubicación a ~1 Hz, y el sistema puede evaluar la
// geocerca con esos fixes. Por eso se marca en el log (live_on / live_off) y en cada evento (liveWatch), y se
// detiene sola cuando la app sale de primer plano. Es para encontrar el borde, no para medir en segundo plano.

import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { appendLog, runtime } from "./spikeStorage";

export interface LiveFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  at: number; // epoch ms del fix
}

const KEEP_AWAKE_TAG = "geocheck-live-panel";

// Devuelve la función que detiene el seguimiento. Mantiene la pantalla encendida mientras corre, porque con la
// pantalla apagada el panel no se ve y la app pasa a segundo plano.
export async function startLiveWatch(onFix: (fix: LiveFix) => void, onError: (message: string) => void): Promise<() => void> {
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
    (location) => onFix({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy ?? null, at: location.timestamp }),
    (message) => onError(message)
  );
  runtime.liveWatch = true;
  void appendLog({ kind: "live_on" });
  void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
  return () => {
    subscription.remove();
    runtime.liveWatch = false;
    void appendLog({ kind: "live_off" });
    void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  };
}
