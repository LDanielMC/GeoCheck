import * as Location from "expo-location";

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null; // ± metros
}

const FIX_TIMEOUT_MS = 25_000;
// Para centrar el mapa basta una posición aproximada y rápida: no se espera un fix de GPS preciso.
const MAP_FIX_TIMEOUT_MS = 8_000;

// ¿Hay permiso de ubicación en primer plano? Con `ask` lo pide si aún no está concedido.
export async function hasLocationAccess(ask: boolean): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  return ask ? (await Location.requestForegroundPermissionsAsync()).granted : false;
}

// Dónde está el teléfono, para centrar el mapa. `fresh` prefiere una lectura nueva (botón «Mi ubicación»); sin ella usa
// primero la última conocida, que es instantánea (apertura del mapa). Devuelve null si no se pudo, sin error: el mapa
// simplemente se queda donde está.
export async function getPositionForMap({ fresh }: { fresh: boolean }): Promise<{ latitude: number; longitude: number } | null> {
  const lastKnown = async () => {
    const last = await Location.getLastKnownPositionAsync();
    return last ? { latitude: last.coords.latitude, longitude: last.coords.longitude } : null;
  };
  const current = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), MAP_FIX_TIMEOUT_MS);
    });
    try {
      const fix = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout]);
      return fix ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude } : null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  try {
    if (!(await Location.hasServicesEnabledAsync())) return null;
    const [first, second] = fresh ? [current, lastKnown] : [lastKnown, current];
    return (await first().catch(() => null)) ?? (await second().catch(() => null));
  } catch {
    return null;
  }
}

// Posición actual con el permiso de primer plano (el de segundo plano no hace falta para fijar el centro de una obra).
// Falla con un mensaje para mostrar tal cual: sin permiso, sin servicios de ubicación o sin señal a tiempo.
export async function getCurrentLocation(): Promise<CurrentLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Falta el permiso de ubicación. Actívalo en los ajustes del teléfono o escribe las coordenadas.");
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Los servicios de ubicación del teléfono están apagados. Actívalos o escribe las coordenadas.");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("No se obtuvo la ubicación a tiempo. Sal a un lugar abierto e inténtalo de nuevo.")), FIX_TIMEOUT_MS);
  });
  try {
    const fix = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeout]);
    return { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy ?? null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
