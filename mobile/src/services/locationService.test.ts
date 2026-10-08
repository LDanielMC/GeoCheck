import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { getCurrentLocation } from "./locationService";

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "granted", granted: true } as never);
  vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 45.5152, longitude: -122.6784, accuracy: 8 }, timestamp: Date.now() } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ubicación actual para fijar el centro de una obra", () => {
  it("devuelve latitud, longitud y la precisión del GPS", async () => {
    expect(await getCurrentLocation()).toEqual({ latitude: 45.5152, longitude: -122.6784, accuracy: 8 });
  });

  it("si el sistema no informa la precisión devuelve null", async () => {
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 1, longitude: 2, accuracy: null }, timestamp: 0 } as never);
    expect((await getCurrentLocation()).accuracy).toBeNull();
  });

  it("sin permiso falla con un mensaje para mostrar y no pide la posición", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "denied", granted: false } as never);
    await expect(getCurrentLocation()).rejects.toThrow(/permiso de ubicación/);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("con los servicios de ubicación apagados lo dice", async () => {
    vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
    await expect(getCurrentLocation()).rejects.toThrow(/servicios de ubicación/);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("si no hay señal en 25 s falla en vez de quedarse colgado", async () => {
    vi.mocked(Location.getCurrentPositionAsync).mockReturnValue(new Promise(() => undefined) as never);
    const pending = getCurrentLocation();
    const assertion = expect(pending).rejects.toThrow(/a tiempo/);
    await vi.advanceTimersByTimeAsync(25_000);
    await assertion;
  });

  it("no deja el temporizador de espera vivo cuando hay posición", async () => {
    await getCurrentLocation();
    expect(vi.getTimerCount()).toBe(0);
  });
});
