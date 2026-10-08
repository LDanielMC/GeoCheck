import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { AddressSearchError, searchAddress } from "./addressSearch";

// ~25 m al norte en Portland: 0.000225° de latitud
const A = { latitude: 45.5152, longitude: -122.6784 };
const FAR = { latitude: 45.52, longitude: -122.68 };
const CLOSE_TO_A = { latitude: A.latitude + 0.0001, longitude: A.longitude }; // ~11 m

const address = (street: string) => ({ streetNumber: "1", street, city: "Portland", region: "OR", postalCode: "97201", country: "United States" });

beforeEach(() => {
  vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "granted", granted: true } as never);
  vi.mocked(Location.geocodeAsync).mockResolvedValue([]);
  vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([]);
});

describe("búsqueda de dirección con el geocodificador del teléfono", () => {
  it("devuelve el lugar con la dirección tal como la entendió el teléfono", async () => {
    vi.mocked(Location.geocodeAsync).mockResolvedValue([A as never]);
    vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([address("SW Main St")] as never);
    expect(await searchAddress("1 SW Main St, Portland, OR")).toEqual([{ label: "1 SW Main St, Portland, OR 97201, United States", ...A }]);
    expect(Location.geocodeAsync).toHaveBeenCalledWith("1 SW Main St, Portland, OR");
  });

  it("recorta la consulta y rechaza una demasiado corta sin llamar al geocodificador", async () => {
    await expect(searchAddress("  ab ")).rejects.toThrow(AddressSearchError);
    await expect(searchAddress("   ")).rejects.toThrow(/dirección completa/);
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("sin permiso de ubicación explica por qué y no busca (Android lo exige para geocodificar)", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "denied", granted: false } as never);
    await expect(searchAddress("123 Main St, Portland, OR")).rejects.toThrow(/permiso de ubicación/);
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
  });

  it("sin resultados devuelve una lista vacía (la pantalla lo explica)", async () => {
    expect(await searchAddress("zzzzzz qqqqqq")).toEqual([]);
  });

  it("si el teléfono no tiene geocodificador, el mensaje lo dice y sugiere alternativas", async () => {
    vi.mocked(Location.geocodeAsync).mockRejectedValue(new Error("Could not find the Geocoder"));
    await expect(searchAddress("123 Main St, Portland, OR")).rejects.toThrow(/no tiene un servicio de búsqueda/);
  });

  it("ante cualquier otro error del geocodificador no filtra el mensaje técnico", async () => {
    vi.mocked(Location.geocodeAsync).mockRejectedValue(new Error("kCLErrorDomain error 2"));
    await expect(searchAddress("123 Main St, Portland, OR")).rejects.toThrow(/Revisa tu conexión/);
    await expect(searchAddress("123 Main St, Portland, OR")).rejects.not.toThrow(/kCLError/);
  });

  it("junta resultados a menos de 25 m (el mismo lugar) y limita a 3", async () => {
    vi.mocked(Location.geocodeAsync).mockResolvedValue([
      A,
      CLOSE_TO_A,
      FAR,
      { latitude: 45.53, longitude: -122.69 },
      { latitude: 45.54, longitude: -122.7 },
    ] as never[]);
    const results = await searchAddress("Main St, Portland, OR");
    expect(results).toHaveLength(3);
    expect(results.map((r) => [r.latitude, r.longitude])).toEqual([
      [A.latitude, A.longitude],
      [FAR.latitude, FAR.longitude],
      [45.53, -122.69],
    ]);
  });

  it("consulta la dirección inversa en SERIE: Expo avisa de que muchas peticiones a la vez pueden fallar", async () => {
    vi.mocked(Location.geocodeAsync).mockResolvedValue([A, FAR, { latitude: 45.53, longitude: -122.69 }] as never[]);
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(Location.reverseGeocodeAsync).mockImplementation((async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return [address("Main St")];
    }) as never);
    await searchAddress("Main St, Portland, OR");
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
  });

  it("si falla la dirección inversa deja el punto con sus coordenadas, sin perder el resultado", async () => {
    vi.mocked(Location.geocodeAsync).mockResolvedValue([A] as never[]);
    vi.mocked(Location.reverseGeocodeAsync).mockRejectedValue(new Error("rate limited"));
    const [result] = await searchAddress("1 Main St, Portland, OR");
    expect(result.label).toBe("45.51520, -122.67840");
    expect(result).toMatchObject(A);
  });

  it("si la dirección inversa no devuelve nada usa las coordenadas como texto", async () => {
    vi.mocked(Location.geocodeAsync).mockResolvedValue([A] as never[]);
    vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([]);
    expect((await searchAddress("1 Main St, Portland, OR"))[0].label).toBe("45.51520, -122.67840");
  });
});
