import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { getPositionForMap, hasLocationAccess } from "./locationService";

const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude, accuracy: 20 }, timestamp: Date.now() }) as never;
const LAST = fix(45.5, -122.6);
const NOW = fix(45.6, -122.7);

beforeEach(() => {
  vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  vi.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(LAST);
  vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("permiso de ubicación para el mapa", () => {
  it("si ya está concedido no vuelve a preguntar", async () => {
    vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ status: "granted", granted: true } as never);
    expect(await hasLocationAccess(true)).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("sin permiso: pregunta solo si se le pide, y respeta la respuesta", async () => {
    vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ status: "undetermined", granted: false } as never);
    expect(await hasLocationAccess(false)).toBe(false);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "denied", granted: false } as never);
    expect(await hasLocationAccess(true)).toBe(false);
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "granted", granted: true } as never);
    expect(await hasLocationAccess(true)).toBe(true);
  });
});

describe("posición para centrar el mapa", () => {
  it("al abrir usa la última conocida (instantánea) sin esperar al GPS", async () => {
    expect(await getPositionForMap({ fresh: false })).toEqual({ latitude: 45.5, longitude: -122.6 });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("sin última conocida, lee la posición actual con precisión media", async () => {
    vi.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
    expect(await getPositionForMap({ fresh: false })).toEqual({ latitude: 45.6, longitude: -122.7 });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it("con el botón prefiere una lectura nueva, y si no llega a tiempo cae en la última conocida", async () => {
    expect(await getPositionForMap({ fresh: true })).toEqual({ latitude: 45.6, longitude: -122.7 });

    vi.useFakeTimers();
    vi.mocked(Location.getCurrentPositionAsync).mockReturnValue(new Promise(() => undefined));
    const pending = getPositionForMap({ fresh: true });
    await vi.advanceTimersByTimeAsync(8_001);
    expect(await pending).toEqual({ latitude: 45.5, longitude: -122.6 });
  });

  it("devuelve null, sin error, si los servicios están apagados o todo falla", async () => {
    vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
    expect(await getPositionForMap({ fresh: true })).toBeNull();

    vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    vi.mocked(Location.getLastKnownPositionAsync).mockRejectedValue(new Error("x"));
    vi.mocked(Location.getCurrentPositionAsync).mockRejectedValue(new Error("y"));
    expect(await getPositionForMap({ fresh: false })).toBeNull();
  });
});
