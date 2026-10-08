import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { api } from "./api";
import { AddressSearchError } from "./addressSearch";
import { fetchSuggestions, newSessionToken, resetSuggestionCooldown, resolveSuggestion } from "./placesApi";

vi.mock("./api", () => ({ api: { get: vi.fn() } }));

const SESSION = newSessionToken();
const get = vi.mocked(api.get);
const httpError = (status: number) => new AxiosError("fallo", "ERR_BAD_RESPONSE", undefined, undefined, { status } as never);
const PORTLAND = { latitude: 45.5152, longitude: -122.6784 };

beforeEach(() => {
  resetSuggestionCooldown();
  vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "granted", granted: true } as never);
  vi.mocked(Location.geocodeAsync).mockResolvedValue([]);
  vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("token de sesión", () => {
  it("tiene la forma que acepta el backend (8–36 caracteres de letras, números, guiones) y cambia cada vez", () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,36}$/);
    expect(newSessionToken()).not.toBe(a);
  });
});

describe("sugerencias de direcciones (Google, a través del backend)", () => {
  it("pide las sugerencias con el texto recortado y el token de sesión", async () => {
    get.mockResolvedValue({ data: { suggestions: [{ placeId: "p1", description: "1 Main St, Portland, OR, USA" }] } });
    expect(await fetchSuggestions("  1 Main St  ", SESSION)).toEqual([{ placeId: "p1", description: "1 Main St, Portland, OR, USA" }]);
    expect(get).toHaveBeenCalledWith("/places/autocomplete", { params: { q: "1 Main St", session: SESSION } });
  });

  it("con menos de 3 caracteres no llama al backend (cada petición cuenta en la cuota de Google)", async () => {
    expect(await fetchSuggestions(" ab ", SESSION)).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("si el backend o Google fallan devuelve null y no reintenta durante un minuto", async () => {
    vi.useFakeTimers();
    get.mockRejectedValue(httpError(503));
    expect(await fetchSuggestions("1 Main St", SESSION)).toBeNull();
    expect(await fetchSuggestions("1 Main St, Port", SESSION)).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);
    get.mockResolvedValue({ data: { suggestions: [] } });
    expect(await fetchSuggestions("1 Main St", SESSION)).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("sin red también devuelve null", async () => {
    get.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(await fetchSuggestions("1 Main St", SESSION)).toBeNull();
  });

  it("un 400 (consulta rechazada) no es una caída: lista vacía y sin pausa", async () => {
    get.mockRejectedValueOnce(httpError(400));
    expect(await fetchSuggestions("1 Main St", SESSION)).toEqual([]);
    get.mockResolvedValue({ data: { suggestions: [] } });
    await fetchSuggestions("1 Main St", SESSION);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("elegir una sugerencia", () => {
  const suggestion = { placeId: "p1", description: "1 Main St, Portland, OR, USA" };

  it("pide las coordenadas con el mismo token de sesión", async () => {
    get.mockResolvedValue({ data: { placeId: "p1", label: "1 Main St, Portland, OR 97201, USA", ...PORTLAND } });
    expect(await resolveSuggestion(suggestion, SESSION)).toEqual({ label: "1 Main St, Portland, OR 97201, USA", ...PORTLAND });
    expect(get).toHaveBeenCalledWith("/places/details", { params: { placeId: "p1", session: SESSION } });
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
  });

  it("si Google falla, ubica la misma dirección con el geocodificador del teléfono", async () => {
    get.mockRejectedValue(httpError(502));
    vi.mocked(Location.geocodeAsync).mockResolvedValue([PORTLAND] as never);
    const place = await resolveSuggestion(suggestion, SESSION);
    expect(Location.geocodeAsync).toHaveBeenCalledWith("1 Main St, Portland, OR, USA");
    expect(place).toMatchObject(PORTLAND);
    expect(place.label).toBe("1 Main St, Portland, OR, USA"); // no las coordenadas
  });

  it("tras un fallo en los detalles también pausa las sugerencias", async () => {
    get.mockRejectedValue(httpError(502));
    vi.mocked(Location.geocodeAsync).mockResolvedValue([PORTLAND] as never);
    await resolveSuggestion(suggestion, SESSION);
    get.mockClear();
    expect(await fetchSuggestions("1 Main St", SESSION)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("si Google y el teléfono fallan, explica cómo seguir", async () => {
    get.mockRejectedValue(httpError(502));
    await expect(resolveSuggestion(suggestion, SESSION)).rejects.toThrow(AddressSearchError);
    await expect(resolveSuggestion(suggestion, SESSION)).rejects.toThrow(/toca el mapa/i);
  });
});
