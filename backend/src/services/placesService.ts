import { HttpError } from "../errors";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const UPSTREAM_TIMEOUT_MS = 5_000;

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export interface PlaceDetails {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface PlacesService {
  autocomplete(input: string, sessionToken: string): Promise<PlaceSuggestion[]>;
  details(placeId: string, sessionToken: string): Promise<PlaceDetails>;
}

interface AutocompleteResponse {
  suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
}

interface DetailsResponse {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

// Cliente de Places API (New). Cuidado con el cobro (precios verificados el 2026-10-08 en la documentación de Google):
// - Autocomplete y Place Details deben llevar el MISMO sessionToken: así las peticiones de autocompletado desde la 13.ª de
//   una sesión no se cobran (SKU «Autocomplete Session Usage») y la sesión termina en el Place Details.
// - Place Details pide solo `location` y `formattedAddress` (SKU Essentials, 10 000 gratis al mes). Un solo campo de otra
//   categoría (por ejemplo `displayName`, que es Pro) subiría toda la petición a esa categoría: no añadir campos sin revisar.
// La clave vive solo en el servidor y viaja en un encabezado, nunca en la URL, para que no acabe en registros.
export function createPlacesService(apiKey: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): PlacesService {
  async function call(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<unknown> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch {
      throw new HttpError(502, "El servicio de direcciones no respondió");
    }
    if (!response.ok) {
      // Solo el código: el cuerpo de Google puede repetir datos de la petición.
      console.error(`Places API respondió ${response.status}`);
      throw new HttpError(502, "El servicio de direcciones no está disponible");
    }
    try {
      return await response.json();
    } catch {
      throw new HttpError(502, "El servicio de direcciones devolvió una respuesta inválida");
    }
  }

  return {
    async autocomplete(input, sessionToken) {
      const body = await call(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
        },
        body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["us"], languageCode: "en" }),
      });
      const suggestions: PlaceSuggestion[] = [];
      for (const item of (body as AutocompleteResponse).suggestions ?? []) {
        const placeId = item.placePrediction?.placeId;
        const description = item.placePrediction?.text?.text;
        if (placeId && description) suggestions.push({ placeId, description });
      }
      return suggestions;
    },

    async details(placeId, sessionToken) {
      const url = `${DETAILS_URL}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
      const body = (await call(url, {
        method: "GET",
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "id,location,formattedAddress" },
      })) as DetailsResponse;
      const { latitude, longitude } = body.location ?? {};
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        throw new HttpError(502, "El servicio de direcciones devolvió una respuesta inválida");
      }
      return { placeId, label: body.formattedAddress ?? "", latitude, longitude };
    },
  };
}
