// Reglas y conversiones del formulario de proyectos. Código puro (sin React Native) para poder probarlo en Node.
// El servidor es quien manda (backend/src/routes/projects.ts): aquí se validan los mismos límites para avisar antes de
// enviar y con mensajes por campo.

import type { Project } from "../types";

// El mínimo sale del spike de geofencing (docs/spike-resultado.md): con un fix de ±100 m un radio de 100 m ya produjo un
// falso positivo, y por debajo la detección en segundo plano no es fiable.
export const MIN_GEOFENCE_RADIUS_M = 100;
export const MAX_GEOFENCE_RADIUS_M = 1000;
export const DEFAULT_GEOFENCE_RADIUS_M = 150;
export const RADIUS_PRESETS = [100, 150, 200, 300];
export const MAX_NAME_LENGTH = 120;
// Por encima de esta precisión (±m) el GPS no sirve para fijar el centro de una obra.
export const POOR_ACCURACY_M = 50;

// Lo que escribe la persona: todo texto, para poder mostrar valores a medio escribir.
export interface ProjectDraft {
  name: string;
  latitude: string;
  longitude: string;
  radius: string;
}

// Lo que entiende el servidor.
export interface ProjectInput {
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
}

export type DraftErrors = Partial<Record<keyof ProjectDraft, string>>;
export type ParseResult = { ok: true; value: ProjectInput } | { ok: false; errors: DraftErrors };

export const emptyDraft = (): ProjectDraft => ({ name: "", latitude: "", longitude: "", radius: String(DEFAULT_GEOFENCE_RADIUS_M) });

export const draftFromProject = (project: Project): ProjectDraft => ({
  name: project.name,
  latitude: String(project.latitude),
  longitude: String(project.longitude),
  radius: String(project.geofenceRadius),
});

// "19,4284" (teclado en español) y "19.4284" valen igual. Texto vacío o con letras → null.
export function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "" || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// El par que copia Google Maps ("18.9254, -99.2217", "latitud, longitud") en un solo texto. Admite paréntesis, coma
// decimal, separador con coma, punto y coma o espacio, y el signo menos tipográfico. Devuelve null si no es un par
// o si cae fuera de rango (lo habitual cuando vienen invertidos: longitud, latitud).
const COORD = String.raw`[-+]?\d+(?:[.,]\d+)?`;
const COORDINATE_PAIR = new RegExp(String.raw`^\s*\(?\s*(${COORD})\s*(?:[,;]\s*|\s+)(${COORD})\s*\)?\s*$`);

export function parseCoordinatePair(text: string): { latitude: number; longitude: number } | null {
  const match = COORDINATE_PAIR.exec(text.replace(/\u2212/g, "-").replace(/°/g, ""));
  if (!match) return null;
  const latitude = parseNumber(match[1]);
  const longitude = parseNumber(match[2]);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function parseDraft(draft: ProjectDraft): ParseResult {
  const errors: DraftErrors = {};

  const name = draft.name.trim();
  if (!name) errors.name = "El nombre es obligatorio";
  else if (name.length > MAX_NAME_LENGTH) errors.name = `El nombre admite hasta ${MAX_NAME_LENGTH} caracteres`;

  const latitude = parseNumber(draft.latitude);
  if (latitude === null) errors.latitude = "Escribe la latitud (por ejemplo 19.4284) o usa tu ubicación";
  else if (latitude < -90 || latitude > 90) errors.latitude = "La latitud va de -90 a 90";

  const longitude = parseNumber(draft.longitude);
  if (longitude === null) errors.longitude = "Escribe la longitud (por ejemplo -99.1677) o usa tu ubicación";
  else if (longitude < -180 || longitude > 180) errors.longitude = "La longitud va de -180 a 180";

  const radius = parseNumber(draft.radius);
  if (radius === null) errors.radius = "Escribe el radio en metros";
  else if (!Number.isInteger(radius)) errors.radius = "El radio debe ser un número entero de metros";
  else if (radius < MIN_GEOFENCE_RADIUS_M) errors.radius = `El radio mínimo es ${MIN_GEOFENCE_RADIUS_M} m: con radios menores la detección automática falla más`;
  else if (radius > MAX_GEOFENCE_RADIUS_M) errors.radius = `El radio máximo es ${MAX_GEOFENCE_RADIUS_M} m`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, latitude: latitude as number, longitude: longitude as number, geofenceRadius: radius as number } };
}

// Solo lo que cambió respecto al proyecto guardado (la API actualiza parcialmente). Latitud y longitud viajan juntas.
export function changedFields(original: Project, input: ProjectInput): Partial<ProjectInput> {
  const changes: Partial<ProjectInput> = {};
  if (input.name !== original.name) changes.name = input.name;
  if (input.geofenceRadius !== original.geofenceRadius) changes.geofenceRadius = input.geofenceRadius;
  if (input.latitude !== original.latitude || input.longitude !== original.longitude) {
    changes.latitude = input.latitude;
    changes.longitude = input.longitude;
  }
  return changes;
}

export const formatCoords = (latitude: number, longitude: number) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

// Abre el punto en la app de mapas del teléfono (sin dependencias ni claves de API).
export const mapsUrl = (latitude: number, longitude: number) => `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

export const isPoorAccuracy = (accuracyM: number | null) => accuracyM != null && accuracyM > POOR_ACCURACY_M;
