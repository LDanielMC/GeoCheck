import * as Location from "expo-location";

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null; // ± metros
}

const FIX_TIMEOUT_MS = 25_000;

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
