// Spike de geofencing — geometría del panel en vivo. Código puro (sin React Native) para poder probarlo en Node.

export interface LatLon {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

// Margen por defecto para dar un cruce por "claro": suficientemente lejos del borde para que el GPS no dude.
export const MARGIN_M = 50;
// Por encima de esta precisión (en metros) el GPS no sirve para decidir de qué lado del borde estás.
export const POOR_ACCURACY_M = 30;

export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Rumbo inicial de `from` hacia `to`, en grados desde el norte (0–360).
export function bearingDeg(from: LatLon, to: LatLon): number {
  const dLon = rad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(rad(to.latitude));
  const x = Math.cos(rad(from.latitude)) * Math.sin(rad(to.latitude)) - Math.sin(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const cardinal = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Metros enteros a partir de 10 m; con un decimal por debajo, donde la diferencia se nota.
export const fmtM = (meters: number) => (meters >= 10 ? String(Math.round(meters)) : String(Math.round(meters * 10) / 10));

export type Side = "inside" | "outside" | "uncertain";

export interface Guidance {
  side: Side;
  edgeM: number; // distancia al borde con signo: negativa dentro, positiva fuera
  poorAccuracy: boolean;
  marginM: number; // margen efectivo (crece si la precisión del GPS es mala)
  exitDistanceM: number; // a esta distancia o más del centro se sale "con margen"
  enterDistanceM: number; // a esta distancia o menos del centro se entra "con margen"
  headline: string;
  hints: string[];
}

// Interpreta una posición respecto al borde. `accuracy` es la precisión horizontal del GPS (±m).
export function guidance(distance: number, radius: number, accuracy: number | null, margin: number = MARGIN_M): Guidance {
  const acc = accuracy ?? 0;
  const edgeM = distance - radius;
  const marginM = Math.max(margin, Math.ceil(acc * 2));
  const exitDistanceM = radius + marginM;
  const enterDistanceM = Math.max(radius - marginM, 0);
  const poorAccuracy = acc > POOR_ACCURACY_M;
  // Si el borde cae dentro del error del GPS, no se puede afirmar de qué lado estás.
  const side: Side = Math.abs(edgeM) <= acc ? "uncertain" : edgeM < 0 ? "inside" : "outside";
  const hints: string[] = [];
  let headline: string;

  if (side === "uncertain") {
    headline = `En el borde (±${fmtM(acc)} m): el GPS no distingue el lado`;
    hints.push(`Aléjate o acércate al menos ${marginM} m para que el cruce sea claro.`);
  } else if (side === "inside") {
    headline = `Dentro · a ${fmtM(-edgeM)} m del borde`;
    if (distance <= enterDistanceM) hints.push(`✔ Dentro con margen (a ≤ ${enterDistanceM} m del centro).`);
    hints.push(`Para SALIR con margen: camina ~${Math.ceil(exitDistanceM - distance)} m más hacia afuera (hasta ≥ ${exitDistanceM} m del centro).`);
  } else {
    headline = `Fuera · a ${fmtM(edgeM)} m del borde`;
    hints.push(
      distance >= exitDistanceM
        ? `✔ Fuera con margen (a ≥ ${exitDistanceM} m del centro). Ya puedes esperar la detección.`
        : `Ya saliste del radio. Para tener margen sigue ~${Math.ceil(exitDistanceM - distance)} m más (hasta ≥ ${exitDistanceM} m).`
    );
    hints.push(`Para ENTRAR con margen: camina ~${Math.ceil(distance - enterDistanceM)} m hacia el centro (hasta ≤ ${enterDistanceM} m).`);
  }

  if (poorAccuracy) hints.push(`Precisión baja (±${fmtM(acc)} m): espera a que mejore antes de decidir.`);
  return { side, edgeM, poorAccuracy, marginM, exitDistanceM, enterDistanceM, headline, hints };
}

// Posición (0–1) del punto dentro de una barra cuya mitad es el borde: sirve para dibujar el medidor.
export function gaugePosition(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  return Math.min(1, Math.max(0, distance / (radius * 2)));
}
