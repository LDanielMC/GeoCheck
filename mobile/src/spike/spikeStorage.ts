// Spike de geofencing — log y configuración persistidos en el dispositivo (sin backend, para que los
// resultados no dependan de la red). Lo escriben tanto la UI como las tareas en segundo plano.

import { AppState } from "react-native";
import * as Battery from "expo-battery";
import { Directory, File, Paths } from "expo-file-system";
import type { SpikeContext, SpikeEntry } from "./analysis";

// Paths.document no lo borra el sistema al liberar espacio (a diferencia de la caché).
const logFile = () => new File(Paths.document, "geocheck-spike-log.jsonl");
const configFile = () => new File(Paths.document, "geocheck-spike-config.json");

export const DEFAULT_RADIUS_M = 150;
export const REGION_ID = "spike-region";

export interface SpikeConfig extends SpikeContext {
  center: { latitude: number; longitude: number } | null;
  radius: number;
  // Una sesión es una geocerca registrada con escenario, perfil, centro y radio fijos. Mientras hay una en curso
  // no se puede cambiar nada de eso: es lo que evita mezclar datos de condiciones distintas.
  session: string | null;
  sessionSeq: number; // contador para numerar las sesiones: S1, S2…
  sessionStartedAt: number | null; // epoch ms: la tarea lo usa para reconocer el evento inicial
  livePanel: boolean;
  markerNotification: boolean; // notificación fija con los botones «Entré» / «Salí»
  markerNotificationId: string | null;
  vibrateOnDetect: boolean;
}

const DEFAULT_CONFIG: SpikeConfig = {
  center: null,
  radius: DEFAULT_RADIUS_M,
  scenario: "1",
  batteryProfile: "default",
  geofenceActive: false,
  session: null,
  sessionSeq: 0,
  sessionStartedAt: null,
  livePanel: true,
  markerNotification: false,
  markerNotificationId: null,
  vibrateOnDetect: true,
};

// Marca de cuándo cargó este contexto de JS. Si una tarea corre con esto muy reciente, la app estaba cerrada
// y el sistema la despertó "en frío" (es justo lo que queremos saber).
export const JS_LOADED_AT = Date.now();
export const COLD_START_THRESHOLD_MS = 15_000;

// Estado de este contexto de JS (no persiste): lo leen las tareas para etiquetar los eventos.
export const runtime = { liveWatch: false };

export function readConfig(): SpikeConfig {
  try {
    const file = configFile();
    if (!file.exists) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(file.textSync()) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(patch: Partial<SpikeConfig>): SpikeConfig {
  const next = { ...readConfig(), ...patch };
  const file = configFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(next));
  return next;
}

async function batterySnapshot() {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    return {
      batteryLevel: level >= 0 ? level : null,
      charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  } catch {
    return { batteryLevel: null, charging: null };
  }
}

export const newMarkerId = () => Math.random().toString(36).slice(2, 8);

// Agrega una línea al log y la devuelve. Nunca lanza: perder una entrada es mejor que romper una tarea en
// segundo plano. Por defecto etiqueta la entrada con el escenario, perfil y sesión en curso; los campos de
// `entry` mandan (así un cruce capturado después puede pertenecer a una sesión anterior).
export async function appendLog(entry: Record<string, unknown> & { kind: SpikeEntry["kind"] }): Promise<SpikeEntry | null> {
  try {
    const { scenario, batteryProfile, geofenceActive, session } = readConfig();
    const full = { t: new Date().toISOString(), ...(await batterySnapshot()), scenario, batteryProfile, geofenceActive, session, ...entry } as SpikeEntry;
    const file = logFile();
    if (!file.exists) file.create();
    // El salto de línea va ANTES de la entrada: si el sistema mató el proceso a mitad de escribir la anterior,
    // esa línea queda truncada (readLog la descarta) en vez de pegarse a esta y perder las dos.
    file.write("\n" + JSON.stringify(full), { append: true });
    return full;
  } catch (error) {
    console.warn("spike: no se pudo escribir el log", error);
    return null;
  }
}

export function readLog(): SpikeEntry[] {
  try {
    const file = logFile();
    if (!file.exists) return [];
    const entries: SpikeEntry[] = [];
    for (const line of file.textSync().split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        // línea truncada por un cierre brusco del proceso: se ignora
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export function clearLog() {
  const file = logFile();
  if (file.exists) file.delete();
  writeConfig({ sessionSeq: 0 });
}

export const currentAppState = () => AppState.currentState ?? "unknown";

// Archivo temporal para compartir: resumen legible arriba y el log crudo (JSONL) abajo.
export function writeExportFile(summary: string, entries: SpikeEntry[], device: Record<string, unknown>): File {
  const dir = new Directory(Paths.cache, "spike-export");
  if (!dir.exists) dir.create();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = new File(dir, `geocheck-spike-${stamp}.txt`);
  if (file.exists) file.delete();
  file.create();
  const body = [
    summary,
    "",
    "## Dispositivo",
    JSON.stringify(device),
    "",
    "## Log crudo (JSONL, hora UTC)",
    ...entries.map((e) => JSON.stringify(e)),
  ].join("\n");
  file.write(body);
  return file;
}
