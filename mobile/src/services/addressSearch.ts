import * as Location from "expo-location";
import { formatAddress } from "../projects/address";
import { distanceMeters } from "../projects/mapRegion";
import { formatCoords } from "../projects/rules";

export interface AddressResult {
  label: string; // la dirección tal como la entendió el teléfono, para que quien busca compruebe que es el lugar
  latitude: number;
  longitude: number;
}

// Error con un mensaje para mostrar tal cual.
export class AddressSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddressSearchError";
  }
}

const MIN_QUERY_LENGTH = 5;
// Cada resultado cuesta una petición de geocodificación inversa y Expo avisa de que muchas a la vez pueden fallar.
const MAX_RESULTS = 3;
// Dos resultados a menos de esto son el mismo lugar.
const SAME_PLACE_M = 25;

// Búsqueda por dirección con el geocodificador del propio teléfono (Android: clase Geocoder del sistema; iOS:
// CLGeocoder). Sin cuenta, sin clave y sin costo, pero sin autocompletar y con calidad que depende del teléfono. Es el
// RESPALDO del autocompletado de Google (placesApi.ts): se usa cuando el backend no tiene servicio o no encuentra nada.
export async function searchAddress(query: string): Promise<AddressResult[]> {
  const text = query.trim();
  if (text.length < MIN_QUERY_LENGTH) {
    throw new AddressSearchError("Escribe la dirección completa: calle, número, ciudad y estado.");
  }

  // La documentación de Expo exige el permiso de ubicación en primer plano para geocodificar en Android.
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new AddressSearchError("El buscador de direcciones necesita el permiso de ubicación. Actívalo en los ajustes del teléfono o toca el mapa.");
  }

  let found: Location.LocationGeocodedLocation[];
  try {
    found = await Location.geocodeAsync(text);
  } catch (error) {
    throw new AddressSearchError(friendlyMessage(error));
  }

  const places: Location.LocationGeocodedLocation[] = [];
  for (const place of found) {
    if (places.every((kept) => distanceMeters(kept, place) > SAME_PLACE_M)) places.push(place);
    if (places.length === MAX_RESULTS) break;
  }

  // En serie, no en paralelo (ver MAX_RESULTS). Si falla la dirección inversa queda al menos el punto con sus coordenadas.
  const results: AddressResult[] = [];
  for (const place of places) {
    let label = formatCoords(place.latitude, place.longitude);
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude: place.latitude, longitude: place.longitude });
      label = (address && formatAddress(address)) || label;
    } catch {
      // se queda con las coordenadas
    }
    results.push({ label, latitude: place.latitude, longitude: place.longitude });
  }
  return results;
}

function friendlyMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/could not find the geocoder/i.test(message)) {
    return "Este teléfono no tiene un servicio de búsqueda de direcciones disponible. Toca el mapa o pega las coordenadas.";
  }
  return "No se pudo buscar la dirección. Revisa tu conexión e inténtalo de nuevo; si repites muchas búsquedas seguidas, espera unos segundos.";
}
