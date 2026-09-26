// Cálculo de distancia entre dos coordenadas GPS (fórmula haversine)
// y verificación de si un punto está dentro del geofence de un proyecto.
// RF-01 a RF-04 del Análisis de Requisitos.

const EARTH_RADIUS_M = 6371000;

export function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

export function isInsideGeofence(
  userLat: number,
  userLon: number,
  projectLat: number,
  projectLon: number,
  radiusMeters: number
): boolean {
  return distanceInMeters(userLat, userLon, projectLat, projectLon) <= radiusMeters;
}

// RNF-03: evitar falsos positivos/negativos en el borde del radio.
// Se recomienda aplicar esta función solo después de N lecturas consecutivas
// consistentes (debounce), no en una sola lectura de GPS.
export const GEOFENCE_DEBOUNCE_READINGS = 3;
