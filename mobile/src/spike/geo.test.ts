import { describe, expect, it } from "vitest";
import { bearingDeg, cardinal, distanceM, fmtM, gaugePosition, guidance, MARGIN_M } from "./geo";

// Punto de referencia (CDMX) y desplazamientos en metros aproximados.
const ORIGIN = { latitude: 19.4284, longitude: -99.1677 };
const M_PER_DEG_LAT = 111_195;
const north = (m: number) => ({ latitude: ORIGIN.latitude + m / M_PER_DEG_LAT, longitude: ORIGIN.longitude });
const east = (m: number) => ({ latitude: ORIGIN.latitude, longitude: ORIGIN.longitude + m / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)) });

describe("distancia y rumbo", () => {
  it("un punto consigo mismo está a 0 m", () => {
    expect(distanceM(ORIGIN, ORIGIN)).toBe(0);
  });

  it("mide desplazamientos al norte y al este con precisión de metros", () => {
    expect(distanceM(ORIGIN, north(100))).toBeCloseTo(100, 0);
    expect(distanceM(ORIGIN, east(100))).toBeCloseTo(100, 0);
    // El caso real de la primera prueba: dos centros separados ~179 m (159 m al norte y 82 m al este).
    const d = distanceM(ORIGIN, { latitude: north(158.8).latitude, longitude: east(82.4).longitude });
    expect(d).toBeGreaterThan(177.5);
    expect(d).toBeLessThan(180.5);
  });

  it("el rumbo hacia los cuatro puntos cardinales", () => {
    expect(bearingDeg(ORIGIN, north(100))).toBeCloseTo(0, 0);
    expect(bearingDeg(ORIGIN, east(100))).toBeCloseTo(90, 0);
    expect(bearingDeg(north(100), ORIGIN)).toBeCloseTo(180, 0);
    expect(bearingDeg(east(100), ORIGIN)).toBeCloseTo(270, 0);
  });

  it("cardinal redondea a los 8 puntos y da la vuelta", () => {
    expect([0, 44, 46, 90, 135, 180, 225, 270, 315, 359, 360].map(cardinal)).toEqual(["N", "NE", "NE", "E", "SE", "S", "SO", "O", "NO", "N", "N"]);
    expect(cardinal(-45)).toBe("NO");
  });

  it("fmtM: entero desde 10 m, un decimal por debajo", () => {
    expect(fmtM(87.4)).toBe("87");
    expect(fmtM(9.84)).toBe("9.8");
    expect(fmtM(0)).toBe("0");
  });
});

describe("guía respecto al borde", () => {
  it("dentro: dice a cuántos metros del borde y cuánto falta para salir con margen", () => {
    const g = guidance(87, 100, 12);
    expect(g.side).toBe("inside");
    expect(g.edgeM).toBeCloseTo(-13, 9);
    expect(g.headline).toBe("Dentro · a 13 m del borde");
    // margen = max(50, 2×12=24) = 50 → meta de salida 150 m: faltan 63 m
    expect(g.exitDistanceM).toBe(150);
    expect(g.hints[0]).toContain("~63 m más hacia afuera");
    expect(g.hints[0]).toContain("≥ 150 m del centro");
  });

  it("fuera con margen: confirma que ya puede esperar la detección y dice cómo volver a entrar", () => {
    const g = guidance(160, 100, 10);
    expect(g.side).toBe("outside");
    expect(g.hints[0]).toContain("✔ Fuera con margen");
    expect(g.hints[1]).toContain("ENTRAR con margen");
    expect(g.hints[1]).toContain("~110 m hacia el centro"); // 160 − (100−50)
  });

  it("fuera pero sin margen: pide seguir caminando", () => {
    const g = guidance(120, 100, 10);
    expect(g.hints[0]).toContain("Ya saliste del radio");
    expect(g.hints[0]).toContain("~30 m más");
  });

  it("dentro y bien adentro: lo reconoce", () => {
    expect(guidance(30, 100, 8).hints.some((h) => h.startsWith("✔ Dentro con margen"))).toBe(true);
  });

  it("en el borde, dentro del error del GPS, no afirma el lado", () => {
    const g = guidance(104, 100, 12);
    expect(g.side).toBe("uncertain");
    expect(g.headline).toContain("En el borde");
    expect(g.hints[0]).toContain("Aléjate o acércate");
  });

  it("con mala precisión el margen crece y avisa", () => {
    const g = guidance(10, 100, 40);
    expect(g.marginM).toBe(80);
    expect(g.exitDistanceM).toBe(180);
    expect(g.poorAccuracy).toBe(true);
    expect(g.hints.at(-1)).toContain("Precisión baja");
  });

  it("sin precisión conocida se comporta como GPS perfecto", () => {
    const g = guidance(99, 100, null);
    expect(g.side).toBe("inside");
    expect(g.marginM).toBe(MARGIN_M);
  });

  it("la meta de entrada nunca es negativa si el margen es mayor que el radio", () => {
    expect(guidance(200, 40, 5).enterDistanceM).toBe(0);
  });
});

describe("medidor", () => {
  it("el borde cae en el centro de la barra y se limita a los extremos", () => {
    expect(gaugePosition(100, 100)).toBe(0.5);
    expect(gaugePosition(0, 100)).toBe(0);
    expect(gaugePosition(500, 100)).toBe(1);
    expect(gaugePosition(10, 0)).toBe(0);
  });
});
