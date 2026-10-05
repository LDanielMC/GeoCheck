// Spike de geofencing — análisis del log. Código puro (sin React Native) para poder probarlo en Node.
//
// El log es una lista de entradas JSON. Las relevantes:
//  - "geofence": evento real del sistema (Enter/Exit) recibido por la tarea en segundo plano.
//  - "marker":   el usuario marca "crucé la frontera ahora" (la verdad de campo para medir latencia).
//  - "snapshot": lectura manual de batería para medir consumo.

export type CrossingType = "enter" | "exit";

export interface SpikeContext {
  scenario: string;
  batteryProfile: string;
  geofenceActive: boolean;
}

export interface BaseEntry extends Partial<SpikeContext> {
  t: string; // ISO UTC
  batteryLevel?: number | null; // 0..1
  charging?: boolean | null;
}

export interface GeofenceEntry extends BaseEntry {
  kind: "geofence";
  type: CrossingType;
  regionState?: string;
  appState: string;
  jsUptimeMs: number; // tiempo desde que cargó el JS: pequeño = la tarea arrancó la app en frío
  cold: boolean;
  lastFixAccuracyM?: number | null;
  lastFixAgeS?: number | null;
}

export interface MarkerEntry extends BaseEntry {
  kind: "marker";
  type: CrossingType;
}

export interface SnapshotEntry extends BaseEntry {
  kind: "snapshot";
  note?: string;
}

export interface OtherEntry extends BaseEntry {
  kind: "app_open" | "register" | "unregister" | "geofence_missing" | "permission" | "error" | "config";
  [key: string]: unknown;
}

export type SpikeEntry = GeofenceEntry | MarkerEntry | SnapshotEntry | OtherEntry;

// Criterios de aceptación acordados.
export const CRITERIA = {
  detectionRate: 0.9,
  enterLatencyS: 3 * 60,
  exitLatencyS: 5 * 60,
  falsePerDay: 1,
  batteryPctPerJourney: 3,
  journeyHours: 10,
};

// Margen para el que el evento llegue unos segundos antes que el toque del marcador, y ventana máxima de espera.
const EARLY_TOLERANCE_MS = 60_000;
const MATCH_WINDOW_MS = 30 * 60_000;
const INITIAL_TRIGGER_WINDOW_MS = 90_000;

export interface MarkerResult {
  scenario: string;
  type: CrossingType;
  markerAt: string;
  status: "detected" | "missed" | "pending";
  latencyS?: number;
  cold?: boolean;
}

export interface ScenarioSummary {
  scenario: string;
  markers: number;
  detected: number;
  missed: number;
  pending: number;
  detectionRate: number | null;
  enterLatenciesS: number[];
  exitLatenciesS: number[];
  medianEnterS: number | null;
  medianExitS: number | null;
  maxEnterS: number | null;
  maxExitS: number | null;
  unmatchedEvents: number; // eventos sin marcador cercano: candidatos a falso positivo o salida/entrada sin marcar
  coldEvents: number;
  events: number;
}

export interface BatteryResult {
  geofenceActive: boolean;
  hours: number;
  dropPct: number;
  pctPerHour: number | null;
}

export interface Summary {
  firstAt: string | null;
  lastAt: string | null;
  totalEntries: number;
  markerResults: MarkerResult[];
  scenarios: ScenarioSummary[];
  battery: BatteryResult[];
  geofenceMissingCount: number;
  initialTriggerEvents: number; // eventos dentro de los 90 s tras registrar la geocerca: Android puede disparar uno inicial
  verdict: { criterion: string; pass: boolean | null; detail: string }[];
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const ms = (iso: string) => new Date(iso).getTime();

export function matchMarkers(entries: SpikeEntry[], now: number = Date.now()) {
  const markers = entries.filter((e): e is MarkerEntry => e.kind === "marker").sort((a, b) => ms(a.t) - ms(b.t));
  const events = entries.filter((e): e is GeofenceEntry => e.kind === "geofence").sort((a, b) => ms(a.t) - ms(b.t));
  const usedEvents = new Set<GeofenceEntry>();
  const results: MarkerResult[] = [];

  for (const [i, marker] of markers.entries()) {
    const start = ms(marker.t) - EARLY_TOLERANCE_MS;
    const nextSameType = markers.slice(i + 1).find((m) => m.type === marker.type);
    const end = Math.min(ms(marker.t) + MATCH_WINDOW_MS, nextSameType ? ms(nextSameType.t) : Infinity);
    const hit = events.find((e) => !usedEvents.has(e) && e.type === marker.type && ms(e.t) >= start && ms(e.t) < end);

    const base = { scenario: marker.scenario ?? "?", type: marker.type, markerAt: marker.t };
    if (hit) {
      usedEvents.add(hit);
      results.push({ ...base, status: "detected", latencyS: Math.max(0, (ms(hit.t) - ms(marker.t)) / 1000), cold: hit.cold });
    } else {
      const waited = now - ms(marker.t);
      results.push({ ...base, status: waited < MATCH_WINDOW_MS ? "pending" : "missed" });
    }
  }
  return { results, unmatchedEvents: events.filter((e) => !usedEvents.has(e)), events };
}

// Consumo: tramos entre lecturas consecutivas de batería, sin cargador en ambos extremos, agrupados por
// si la geocerca estaba activa. Es una estimación gruesa; el número fiable es el de Ajustes › Batería › Uso por app.
export function batteryRates(entries: SpikeEntry[]): BatteryResult[] {
  const withBattery = entries
    .filter((e) => typeof e.batteryLevel === "number" && e.charging === false)
    .sort((a, b) => ms(a.t) - ms(b.t));
  const acc = new Map<boolean, { hours: number; drop: number }>();

  for (let i = 1; i < withBattery.length; i++) {
    const a = withBattery[i - 1];
    const b = withBattery[i];
    // Solo cuentan tramos entre lecturas explícitas (snapshots) o de eventos, pero nunca a través de una carga:
    // entre a y b no puede haber ninguna lectura con cargador.
    const between = entries.some((e) => e.charging === true && ms(e.t) > ms(a.t) && ms(e.t) < ms(b.t));
    const hours = (ms(b.t) - ms(a.t)) / 3_600_000;
    const drop = ((a.batteryLevel as number) - (b.batteryLevel as number)) * 100;
    // <15 min: demasiado ruido; drop<0: hubo carga no registrada; estados distintos: el tramo mezcla ambos.
    if (between || hours < 0.25 || drop < 0 || (a.geofenceActive === true) !== (b.geofenceActive === true)) continue;
    const key = a.geofenceActive === true;
    const cur = acc.get(key) ?? { hours: 0, drop: 0 };
    acc.set(key, { hours: cur.hours + hours, drop: cur.drop + drop });
  }

  return [...acc.entries()].map(([geofenceActive, { hours, drop }]) => ({
    geofenceActive,
    hours,
    dropPct: drop,
    pctPerHour: hours > 0 ? drop / hours : null,
  }));
}

export function summarize(entries: SpikeEntry[], now: number = Date.now()): Summary {
  const sorted = [...entries].sort((a, b) => ms(a.t) - ms(b.t));
  const matched = matchMarkers(sorted, now);
  const { results, events } = matched;
  const registerTimes = sorted.filter((e) => e.kind === "register").map((e) => ms(e.t));
  const isInitial = (e: GeofenceEntry) => registerTimes.some((r) => ms(e.t) - r >= 0 && ms(e.t) - r <= INITIAL_TRIGGER_WINDOW_MS);
  const initialTriggerEvents = matched.unmatchedEvents.filter(isInitial).length;
  const unmatchedEvents = matched.unmatchedEvents.filter((e) => !isInitial(e));
  const scenarioIds = [...new Set([...results.map((r) => r.scenario), ...events.map((e) => e.scenario ?? "?")])].sort();

  const scenarios: ScenarioSummary[] = scenarioIds.map((scenario) => {
    const mine = results.filter((r) => r.scenario === scenario);
    const detected = mine.filter((r) => r.status === "detected");
    const missed = mine.filter((r) => r.status === "missed").length;
    const pending = mine.filter((r) => r.status === "pending").length;
    const enters = detected.filter((r) => r.type === "enter").map((r) => r.latencyS as number);
    const exits = detected.filter((r) => r.type === "exit").map((r) => r.latencyS as number);
    const resolved = detected.length + missed;
    const myEvents = events.filter((e) => (e.scenario ?? "?") === scenario);
    return {
      scenario,
      markers: mine.length,
      detected: detected.length,
      missed,
      pending,
      detectionRate: resolved > 0 ? detected.length / resolved : null,
      enterLatenciesS: enters,
      exitLatenciesS: exits,
      medianEnterS: median(enters),
      medianExitS: median(exits),
      maxEnterS: enters.length ? Math.max(...enters) : null,
      maxExitS: exits.length ? Math.max(...exits) : null,
      unmatchedEvents: unmatchedEvents.filter((e) => (e.scenario ?? "?") === scenario).length,
      coldEvents: myEvents.filter((e) => e.cold).length,
      events: myEvents.length,
    };
  });

  const battery = batteryRates(sorted);
  const geofenceMissingCount = sorted.filter((e) => e.kind === "geofence_missing").length;

  const resolved = results.filter((r) => r.status !== "pending");
  const detected = results.filter((r) => r.status === "detected");
  const rate = resolved.length ? detected.length / resolved.length : null;
  const enterMax = Math.max(0, ...detected.filter((r) => r.type === "enter").map((r) => r.latencyS as number));
  const exitMax = Math.max(0, ...detected.filter((r) => r.type === "exit").map((r) => r.latencyS as number));
  const on = battery.find((b) => b.geofenceActive);
  const off = battery.find((b) => !b.geofenceActive);
  const extraPerJourney = on?.pctPerHour != null && off?.pctPerHour != null ? (on.pctPerHour - off.pctPerHour) * CRITERIA.journeyHours : null;
  const firstAt = sorted[0]?.t ?? null;
  const lastAt = sorted.at(-1)?.t ?? null;
  const days = firstAt && lastAt ? Math.max(1, (ms(lastAt) - ms(firstAt)) / 86_400_000) : 1;

  const stationary = scenarios.filter((s) => s.scenario === "7" || s.scenario === "6");
  const stationaryFalse = stationary.reduce((n, s) => n + s.unmatchedEvents, 0);

  const verdict: Summary["verdict"] = [
    {
      criterion: "≥90 % de entradas y salidas detectadas",
      pass: rate == null ? null : rate >= CRITERIA.detectionRate,
      detail: rate == null ? "sin marcadores resueltos" : `${detected.length}/${resolved.length} (${(rate * 100).toFixed(0)} %)`,
    },
    {
      criterion: "Latencia de entrada ≤ 3 min (máx.)",
      pass: detected.some((r) => r.type === "enter") ? enterMax <= CRITERIA.enterLatencyS : null,
      detail: detected.some((r) => r.type === "enter") ? `máx. ${fmtS(enterMax)}` : "sin datos",
    },
    {
      criterion: "Latencia de salida ≤ 5 min (máx.)",
      pass: detected.some((r) => r.type === "exit") ? exitMax <= CRITERIA.exitLatencyS : null,
      detail: detected.some((r) => r.type === "exit") ? `máx. ${fmtS(exitMax)}` : "sin datos",
    },
    {
      criterion: "≤ 1 transición falsa por día quieto (escenarios 6 y 7)",
      pass: stationary.length ? stationaryFalse / days <= CRITERIA.falsePerDay : null,
      detail: stationary.length ? `${stationaryFalse} eventos sin marcador en ${days.toFixed(1)} día(s)` : "sin datos de escenarios 6/7",
    },
    {
      criterion: `Batería ≤ ${CRITERIA.batteryPctPerJourney} % por jornada (${CRITERIA.journeyHours} h)`,
      pass: extraPerJourney == null ? null : extraPerJourney <= CRITERIA.batteryPctPerJourney,
      detail: extraPerJourney == null ? "faltan tramos con y sin geocerca" : `≈ ${extraPerJourney.toFixed(1)} % extra por jornada (estimación gruesa)`,
    },
  ];

  return { firstAt, lastAt, totalEntries: sorted.length, markerResults: results, scenarios, battery, geofenceMissingCount, initialTriggerEvents, verdict };
}

export function fmtS(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Hora local legible, para que quien lee el reporte la relacione con lo que vivió.
export function fmtLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function summaryText(summary: Summary): string {
  const lines: string[] = ["# Resumen del spike de geofencing", ""];
  lines.push(`Entradas de log: ${summary.totalEntries}  |  ${summary.firstAt ?? "—"} → ${summary.lastAt ?? "—"}`);
  if (summary.geofenceMissingCount) lines.push(`⚠ La geocerca había desaparecido del sistema ${summary.geofenceMissingCount} vez/veces (ver "geofence_missing").`);
  if (summary.initialTriggerEvents) lines.push(`Eventos inmediatos tras registrar la geocerca (no cuentan como falsos): ${summary.initialTriggerEvents}`);
  lines.push("", "## Criterios");
  for (const v of summary.verdict) lines.push(`- [${v.pass == null ? "?" : v.pass ? "OK" : "FALLA"}] ${v.criterion}: ${v.detail}`);
  lines.push("", "## Por escenario");
  for (const s of summary.scenarios) {
    lines.push(
      `- Esc. ${s.scenario}: marcadores ${s.markers} (detectados ${s.detected}, perdidos ${s.missed}, pendientes ${s.pending}) · ` +
        `entrada med/máx ${fmtS(s.medianEnterS)}/${fmtS(s.maxEnterS)} · salida med/máx ${fmtS(s.medianExitS)}/${fmtS(s.maxExitS)} · ` +
        `eventos ${s.events} (en frío ${s.coldEvents}, sin marcador ${s.unmatchedEvents})`
    );
  }
  lines.push("", "## Batería (estimación gruesa por snapshots; el dato fiable es Ajustes › Batería)");
  if (summary.battery.length === 0) lines.push("- sin tramos válidos (necesita ≥2 snapshots sin cargador y ≥15 min entre ellos)");
  for (const b of summary.battery) {
    lines.push(`- geocerca ${b.geofenceActive ? "ACTIVA" : "inactiva"}: ${b.dropPct.toFixed(1)} % en ${b.hours.toFixed(1)} h = ${b.pctPerHour?.toFixed(2) ?? "—"} %/h`);
  }
  lines.push("", "## Marcadores");
  for (const r of summary.markerResults) {
    lines.push(`- ${fmtLocal(r.markerAt)} esc.${r.scenario} ${r.type}: ${r.status}${r.latencyS != null ? ` (${fmtS(r.latencyS)}${r.cold ? ", en frío" : ""})` : ""}`);
  }
  return lines.join("\n");
}
