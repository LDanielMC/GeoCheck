import axios from "axios";
import { formatCoords } from "../projects/rules";
import { AddressSearchError, searchAddress, type AddressResult } from "./addressSearch";
import { api } from "./api";

export interface AddressSuggestion {
  placeId: string;
  description: string;
}

export const MIN_SUGGEST_LENGTH = 3;
// Tras un fallo del backend o de Google no se vuelve a intentar durante este tiempo: así escribir una dirección no
// dispara una petición fallida por tecla y la pantalla se queda con el buscador del teléfono.
const COOLDOWN_MS = 60_000;

let unavailableUntil = 0;

export const resetSuggestionCooldown = () => {
  unavailableUntil = 0;
};

// Token de la sesión de autocompletado: agrupa las pulsaciones y el Place Details final para que Google las cobre como una
// sola búsqueda. Uno nuevo por cada dirección elegida. Google admite cualquier cadena; el backend pide 8–36 caracteres.
export function newSessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

// Sugerencias de Google a través del backend. Devuelve null si no hay servicio (sin clave en el servidor, sin red, Google
// caído, límite de uso): quien llama pasa al buscador del teléfono. Una lista vacía significa «sin coincidencias».
export async function fetchSuggestions(query: string, sessionToken: string): Promise<AddressSuggestion[] | null> {
  const text = query.trim();
  if (text.length < MIN_SUGGEST_LENGTH) return [];
  if (Date.now() < unavailableUntil) return null;
  try {
    const { data } = await api.get<{ suggestions: AddressSuggestion[] }>("/places/autocomplete", { params: { q: text, session: sessionToken } });
    return data.suggestions;
  } catch (error) {
    // Un 400 es una consulta que el servidor no aceptó, no una caída del servicio.
    if (axios.isAxiosError(error) && error.response?.status === 400) return [];
    unavailableUntil = Date.now() + COOLDOWN_MS;
    return null;
  }
}

// Coordenadas del lugar elegido (Place Details). Cierra la sesión de autocompletado. Si falla, se ubica la misma dirección
// con el geocodificador del teléfono; solo si tampoco puede se muestra el error.
export async function resolveSuggestion(suggestion: AddressSuggestion, sessionToken: string): Promise<AddressResult> {
  try {
    const { data } = await api.get<{ label: string; latitude: number; longitude: number }>("/places/details", {
      params: { placeId: suggestion.placeId, session: sessionToken },
    });
    return { label: data.label || suggestion.description, latitude: data.latitude, longitude: data.longitude };
  } catch {
    unavailableUntil = Date.now() + COOLDOWN_MS;
  }

  const [fallback] = await searchAddress(suggestion.description);
  if (!fallback) throw new AddressSearchError("No se pudo ubicar esa dirección. Toca el mapa para colocar el pin.");
  return { ...fallback, label: fallback.label === formatCoords(fallback.latitude, fallback.longitude) ? suggestion.description : fallback.label };
}
