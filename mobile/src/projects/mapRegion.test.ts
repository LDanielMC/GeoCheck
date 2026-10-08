import { describe, expect, it } from "vitest";
import { DEFAULT_REGION, distanceMeters, regionForCircle, roundCoordinate, stepRadius } from "./mapRegion";

const PORTLAND = { latitude: 45.5152, longitude: -122.6784 };
const METERS_PER_DEGREE_LAT = 111_320;

describe("región del mapa para un círculo", () => {
  it("abarca el círculo completo con margen alrededor", () => {
    for (const radius of [100, 150, 300, 1000]) {
      const region = regionForCircle(PORTLAND, radius);
      const spanM = region.latitudeDelta * METERS_PER_DEGREE_LAT;
      expect(spanM, `radio ${radius}`).toBeGreaterThanOrEqual(radius * 2 * 2); // al menos el doble del diámetro
    }
  });

  it("se centra en el punto", () => {
    expect(regionForCircle(PORTLAND, 150)).toMatchObject(PORTLAND);
  });

  it("con radios chicos no se acerca por debajo de ~450 m de lado", () => {
    const region = regionForCircle(PORTLAND, 100);
    expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.004);
  });

  it("a mayor radio, mayor región", () => {
    expect(regionForCircle(PORTLAND, 1000).latitudeDelta).toBeGreaterThan(regionForCircle(PORTLAND, 300).latitudeDelta);
  });

  it("lejos del ecuador ensancha la longitud para que el círculo se vea redondo", () => {
    const equator = regionForCircle({ latitude: 0, longitude: 0 }, 300);
    const oregon = regionForCircle(PORTLAND, 300);
    expect(equator.longitudeDelta).toBeCloseTo(equator.latitudeDelta, 6);
    expect(oregon.longitudeDelta / oregon.latitudeDelta).toBeCloseTo(1 / Math.cos((PORTLAND.latitude * Math.PI) / 180), 3);
  });

  it("cerca de los polos no explota", () => {
    const region = regionForCircle({ latitude: 89.99, longitude: 0 }, 1000);
    expect(Number.isFinite(region.longitudeDelta)).toBe(true);
    expect(region.longitudeDelta).toBeLessThanOrEqual(360);
  });

  it("la vista inicial sin ubicación es EE. UU. continental", () => {
    expect(DEFAULT_REGION.latitude).toBeGreaterThan(24);
    expect(DEFAULT_REGION.latitude).toBeLessThan(50);
    expect(DEFAULT_REGION.longitude).toBeLessThan(-66);
    expect(DEFAULT_REGION.longitude).toBeGreaterThan(-125);
  });
});

describe("ajuste del radio", () => {
  it("sube y baja de 50 en 50", () => {
    expect(stepRadius(150, 50)).toBe(200);
    expect(stepRadius(200, -50)).toBe(150);
  });

  it("no baja de 100 m ni sube de 1000 m", () => {
    expect(stepRadius(100, -50)).toBe(100);
    expect(stepRadius(120, -50)).toBe(100);
    expect(stepRadius(1000, 50)).toBe(1000);
    expect(stepRadius(980, 50)).toBe(1000);
  });

  it("devuelve siempre un entero y tolera un valor no numérico", () => {
    expect(Number.isInteger(stepRadius(155.4, 50))).toBe(true);
    expect(stepRadius(Number.NaN, 50)).toBe(150); // parte del mínimo (100) + 50
  });
});

describe("distancia y redondeo", () => {
  it("un grado de latitud son ~111 km y un punto consigo mismo está a 0", () => {
    expect(distanceMeters(PORTLAND, PORTLAND)).toBe(0);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeGreaterThan(111_000);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeLessThan(111_400);
  });

  it("25 m al este en Portland miden ~25 m", () => {
    const east = { latitude: PORTLAND.latitude, longitude: PORTLAND.longitude + 25 / (METERS_PER_DEGREE_LAT * Math.cos((PORTLAND.latitude * Math.PI) / 180)) };
    expect(distanceMeters(PORTLAND, east)).toBeCloseTo(25, 0);
  });

  it("roundCoordinate deja 6 decimales", () => {
    expect(roundCoordinate(45.51523456789)).toBe(45.515235);
    expect(roundCoordinate(-122.6784)).toBe(-122.6784);
  });
});
