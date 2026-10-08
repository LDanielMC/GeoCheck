// Geometría del selector de ubicación en mapa. Código puro (sin React Native) para poder probarlo en Node.

import { MAX_GEOFENCE_RADIUS_M, MIN_GEOFENCE_RADIUS_M } from "./rules";

export interface LatLng {
  latitude: number;
  longitude: number;
}

// Mismo formato que la `Region` de react-native-maps.
export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

const METERS_PER_DEGREE_LAT = 111_320;
const EARTH_RADIUS_M = 6_371_000;

// Vista inicial sin ubicación: EE. UU. continental (el primer cliente está en Oregon).
export const DEFAULT_REGION: MapRegion = { latitude: 39.5, longitude: -98.35, latitudeDelta: 40, longitudeDelta: 40 };

// La vista abarca este múltiplo del diámetro del círculo: deja ver el entorno para ubicarse y tocar el mapa.
const CIRCLE_PADDING = 2.5;
// Con radios chicos no se acerca más que esto (~450 m de lado): el mapa se vería sin referencias.
const MIN_LATITUDE_DELTA = 0.004;

export function regionForCircle(center: LatLng, radiusM: number): MapRegion {
  const latitudeDelta = Math.min(Math.max((radiusM * 2 * CIRCLE_PADDING) / METERS_PER_DEGREE_LAT, MIN_LATITUDE_DELTA), 170);
  // Un grado de longitud mide menos lejos del ecuador: se ensancha para que el círculo se vea redondo.
  const longitudeDelta = Math.min(latitudeDelta / Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01), 360);
  return { latitude: center.latitude, longitude: center.longitude, latitudeDelta, longitudeDelta };
}

// Sube o baja el radio sin salirse de los límites. Con enteros de entrada devuelve enteros.
export function stepRadius(current: number, delta: number): number {
  const base = Number.isFinite(current) ? current : MIN_GEOFENCE_RADIUS_M;
  return Math.min(MAX_GEOFENCE_RADIUS_M, Math.max(MIN_GEOFENCE_RADIUS_M, Math.round(base + delta)));
}

// Distancia en metros (haversine).
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// El mapa devuelve coordenadas con muchos decimales: 6 (~0,1 m) son más que suficientes para una geocerca.
export const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;
