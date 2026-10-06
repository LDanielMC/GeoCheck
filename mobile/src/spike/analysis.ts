// Spike de geofencing — análisis del log. Código puro (sin React Native) para poder probarlo en Node.
//
// El log es una lista de entradas JSON. Las que usa el análisis:
//  - "session_start" / "session_end": una sesión es una geocerca registrada bajo condiciones fijas (escenario,
//    perfil de batería, centro y radio). Nada se mezcla entre sesiones: un marcador solo puede emparejarse con
//    eventos de su propia sesión.
//  - "geofence": evento real del sistema (Enter/Exit) recibido por la tarea en segundo plano.
//  - "marker": el usuario marca "crucé la frontera" (la verdad de campo para medir la latencia).
//  - "marker_undo": anula un marcador hecho por error.
//  - "snapshot": lectura manual de batería.
//  - "register" / "unregister": los usan los logs anteriores a las sesiones; de ellos se infieren sesiones.

export type CrossingType = "enter" | "exit";

export interface SpikeContext {
  scenario: string;
  batteryProfile: string;
  geofenceActive: boolean;
}

export interface BaseEntry extends Partial<SpikeContext> {
  t: string; // ISO UTC
  session?: string | null; // undefined = log anterior a las sesiones
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
  initial?: boolean; // evento inmediato tras registrar la geocerca (Android informa el estado actual)
  restored?: boolean; // evento al abrir la app desde cero: Expo vuelve a registrar la geocerca y Android informa el estado actual
  liveWatch?: boolean; // el panel en vivo estaba pidiendo ubicación cuando llegó el evento
  lastFixAccuracyM?: number | null;
  lastFixAgeS?: number | null;
}

export type MarkerVia = "app" | "notification" | "manual_time";

export interface MarkerEntry extends BaseEntry {
  kind: "marker";
  type: CrossingType;
  id?: string;
  via?: MarkerVia;
  capturedAt?: string; // en "manual_time", cuándo se capturó (t es la hora real del cruce)
  cold?: boolean; // en "notification": la app estaba cerrada y el marcador arrancó el proceso
  notificationKey?: string;
}

export interface MarkerUndoEntry extends BaseEntry {
  kind: "marker_undo";
  markerId?: string;
  markerT?: string;
}

export interface SnapshotEntry extends BaseEntry {
  kind: "snapshot";
  note?: string;
}

export interface RegisterEntry extends BaseEntry {
  kind: "register";
  radius?: number;
}

export interface SessionStartEntry extends BaseEntry {
  kind: "session_start";
  radius?: number;
  batteryOptimization?: boolean | null;
  batteryCheckOverridden?: boolean;
}

export interface SessionEndEntry extends BaseEntry {
  kind: "session_end";
  reason?: string;
}

export interface OtherEntry extends BaseEntry {
  kind:
    | "app_open"
    | "unregister"
    | "geofence_missing"
    | "permission"
    | "error"
    | "config"
    | "live_on"
    | "live_off"
    | "marker_notification";
  [key: string]: unknown;
}

export type SpikeEntry =
  | GeofenceEntry
  | MarkerEntry
  | MarkerUndoEntry
  | SnapshotEntry
  | RegisterEntry
  | SessionStartEntry
  | SessionEndEntry
  | OtherEntry;

// Criterios de aceptación acordados.
export const CRITERIA = {
  detectionRate: 0.9,
  enterLatencyS: 3 * 60,
  exitLatencyS: 5 * 60,
  falsePerDay: 1,
  batteryPctPerJourney: 3,
  journeyHours: 10,
  // Con menos muestras que esto un "OK" o un "FALLA" engaña (1 de 1 = 100 %).
  minDetectionSamples: 5,
  minLatencySamples: 3,
};

// Margen para que el evento llegue unos segundos antes que el toque del marcador, y ventana máxima de espera.
const EARLY_TOLERANCE_MS = 60_000;
const MATCH_WINDOW_MS = 30 * 60_000;
// Una sesión cerrada antes de esto sin evento no cuenta como "perdido": el sistema no tuvo tiempo razonable.
const MIN_WAIT_BEFORE_MISS_MS = 10 * 60_000;
// Expo registra la geocerca con INITIAL_TRIGGER_ENTER | INITIAL_TRIGGER_EXIT: al registrarla (o al volver a
// registrarla cuando arranca un proceso nuevo de la app) Android informa el estado actual casi al instante
// (observado: ~0,2 s), ENTER si estás dentro y EXIT si estás fuera. No es un cruce.
export const INITIAL_TRIGGER_WINDOW_MS = 15_000;
// Dos eventos del mismo tipo seguidos no pueden ser dos cruces físicos (tendrían que alternar): el segundo es un
// re-registro. Es lo que pasa cuando un evento real despierta la app y Expo la vuelve a registrar.
const DUPLICATE_WINDOW_MS = 10_000;
// Un evento tan cerca de una interacción tuya con el teléfono no dice si el sistema lo habría detectado solo.
const INTERACTION_WINDOW_MS = 10_000;
const INTERACTION_KINDS = new Set<string>(["app_open", "marker", "snapshot", "permission", "register", "unregister", "session_start", "live_on", "config"]);

export type MarkerStatus = "detected" | "missed" | "pending" | "cancelled";

export interface MarkerResult {
  id?: string;
  session: string;
  scenario: string;
  type: CrossingType;
  markerAt: string;
  via?: MarkerVia;
  status: MarkerStatus;
  latencyS?: number;
  eventAt?: string;
  cold?: boolean;
}

export interface SessionInfo {
  id: string;
  scenario: string;
  batteryProfile: string;
  startedAt: number;
  endedAt?: number;
  endReason?: string;
  radius?: number;
  legacy: boolean; // inferida de un log anterior a las sesiones
  batteryOptimization?: boolean | null;
  batteryCheckOverridden?: boolean;
}

export interface SessionSummary extends SessionInfo {
  markers: number;
  detected: number;
  missed: number;
  pending: number;
  cancelled: number;
  events: number; // eventos reales (sin los iniciales ni los re-registros)
  initialEvents: number;
  restoredEvents: number;
  unmatchedEvents: number;
  coldEvents: number;
}

export interface ScenarioSummary {
  scenario: string;
  sessions: number;
  markers: number;
  detected: number;
  missed: number;
  pending: number;
  cancelled: number;
  detectionRate: number | null;
  enterLatenciesS: number[];
  exitLatenciesS: number[];
  medianEnterS: number | null;
  medianExitS: number | null;
  maxEnterS: number | null;
  maxExitS: number | null;
  events: number;
  unmatchedEvents: number; // eventos sin marcador cercano: candidatos a falso positivo (o un cruce que no marcaste)
  coldEvents: number;
}

export interface BatteryResult {
  geofenceActive: boolean;
  hours: number;
  dropPct: number;
  pctPerHour: number | null;
}

export interface Diagnostics {
  events: number; // eventos reales, sin los iniciales
  foreground: number; // llegaron con la app en primer plano
  cold: number; // la tarea arrancó la app desde cero
  afterInteraction: number; // a ≤ 10 s de una interacción tuya con el teléfono
  withLiveWatch: number; // con el panel en vivo pidiendo ubicación
}

export type VerdictStatus = "ok" | "fail" | "insufficient" | "nodata";

export interface Verdict {
  criterion: string;
  status: VerdictStatus;
  detail: string;
}

export interface Summary {
  firstAt: string | null;
  lastAt: string | null;
  totalEntries: number;
  sessions: SessionSummary[];
  markerResults: MarkerResult[];
  scenarios: ScenarioSummary[];
  battery: BatteryResult[];
  diagnostics: Diagnostics;
  geofenceMissingCount: number;
  initialTriggerEvents: number;
  restoredEvents: number;
  markersWithoutSession: number;
  verdict: Verdict[];
}

const ms = (iso: string) => new Date(iso).getTime();
const byTime = (a: SpikeEntry, b: SpikeEntry) => ms(a.t) - ms(b.t);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Tagged {
  e: SpikeEntry;
  at: number;
  session: string | null;
}

// Asigna cada entrada a su sesión. Los logs anteriores a las sesiones (sin campo "session") se parten en cada
// "register" y se cierran en "unregister".
function tagSessions(sorted: SpikeEntry[]): { tagged: Tagged[]; sessions: Map<string, SessionInfo> } {
  const sessions = new Map<string, SessionInfo>();
  const tagged: Tagged[] = [];
  let legacySeq = 0;
  let legacyCurrent: string | null = null;

  for (const e of sorted) {
    let session: string | null;
    if (typeof e.session === "string") {
      session = e.session;
      let info = sessions.get(session);
      if (!info) {
        info = { id: session, scenario: e.scenario ?? "?", batteryProfile: e.batteryProfile ?? "default", startedAt: ms(e.t), legacy: false };
        sessions.set(session, info);
      }
      if (e.kind === "session_start") {
        info.startedAt = ms(e.t);
        info.scenario = e.scenario ?? info.scenario;
        info.batteryProfile = e.batteryProfile ?? info.batteryProfile;
        info.radius = e.radius;
        info.batteryOptimization = e.batteryOptimization;
        info.batteryCheckOverridden = e.batteryCheckOverridden;
      } else if (e.kind === "session_end") {
        info.endedAt = ms(e.t);
        info.endReason = e.reason;
      }
    } else if (e.session === null) {
      session = null;
    } else {
      if (e.kind === "register") {
        legacyCurrent = `legacy-${++legacySeq}`;
        sessions.set(legacyCurrent, {
          id: legacyCurrent,
          scenario: e.scenario ?? "?",
          batteryProfile: e.batteryProfile ?? "default",
          startedAt: ms(e.t),
          radius: e.radius,
          legacy: true,
        });
      }
      session = legacyCurrent;
      if (legacyCurrent && (e.kind === "unregister" || e.kind === "geofence_missing")) {
        const info = sessions.get(legacyCurrent) as SessionInfo;
        info.endedAt = ms(e.t);
        info.endReason = e.kind;
        legacyCurrent = null;
      }
    }
    tagged.push({ e, at: ms(e.t), session });
  }
  return { tagged, sessions };
}

// La sesión que estaba abierta a esa hora: sirve para asignar un cruce capturado después, con su hora real.
export function sessionAt(entries: SpikeEntry[], atMs: number): SessionInfo | null {
  const { sessions } = tagSessions([...entries].sort(byTime));
  let found: SessionInfo | null = null;
  for (const info of sessions.values()) {
    const open = info.endedAt === undefined || atMs <= info.endedAt;
    if (atMs >= info.startedAt && open && (!found || info.startedAt > found.startedAt)) found = info;
  }
  return found;
}

function undoneMarkers(entries: SpikeEntry[]) {
  const ids = new Set<string>();
  const times = new Set<string>();
  for (const e of entries) {
    if (e.kind !== "marker_undo") continue;
    if (e.markerId) ids.add(e.markerId);
    else if (e.markerT) times.add(e.markerT);
  }
  return (m: MarkerEntry) => (m.id !== undefined && ids.has(m.id)) || times.has(m.t);
}

function isInitial(e: GeofenceEntry, info: SessionInfo | undefined): boolean {
  if (e.initial !== undefined) return e.initial;
  if (!info) return false;
  const elapsed = ms(e.t) - info.startedAt;
  return elapsed >= 0 && elapsed <= INITIAL_TRIGGER_WINDOW_MS;
}

interface MatchOutcome {
  results: MarkerResult[];
  unmatched: GeofenceEntry[];
  initial: GeofenceEntry[];
  restored: GeofenceEntry[];
  events: GeofenceEntry[];
  markersWithoutSession: number;
}

// Empareja cada marcador con el primer evento de su misma sesión y tipo que llegue en su ventana. Los eventos
// iniciales y los re-registros (abrir la app desde cero, duplicados) nunca se emparejan con un marcador: no son una
// detección del sistema y harían pasar por detectado un cruce que quizá se perdió.
function matchSessions(tagged: Tagged[], sessions: Map<string, SessionInfo>, now: number): MatchOutcome {
  const undone = undoneMarkers(tagged.map((t) => t.e));
  const results: MarkerResult[] = [];
  const unmatched: GeofenceEntry[] = [];
  const initial: GeofenceEntry[] = [];
  const restored: GeofenceEntry[] = [];
  const events: GeofenceEntry[] = [];
  let markersWithoutSession = 0;

  for (const t of tagged) {
    if (t.e.kind === "marker" && t.session === null && !undone(t.e)) markersWithoutSession++;
  }

  for (const [sessionId, info] of sessions) {
    const mine = tagged.filter((t) => t.session === sessionId);
    const markers = mine.filter((t) => t.e.kind === "marker" && !undone(t.e as MarkerEntry)).sort((a, b) => a.at - b.at);
    const sessionEvents = mine.filter((t) => t.e.kind === "geofence").sort((a, b) => a.at - b.at);
    const candidates: Tagged[] = [];
    let previous: Tagged | undefined;
    for (const ev of sessionEvents) {
      const g = ev.e as GeofenceEntry;
      const previousEvent = previous?.e as GeofenceEntry | undefined;
      const duplicate = previous !== undefined && previousEvent?.type === g.type && ev.at - previous.at <= DUPLICATE_WINDOW_MS;
      if (isInitial(g, info)) initial.push(g);
      else if (g.restored === true || duplicate) restored.push(g);
      else {
        candidates.push(ev);
        events.push(g);
      }
      previous = ev;
    }
    const used = new Set<Tagged>();

    for (const [i, m] of markers.entries()) {
      const marker = m.e as MarkerEntry;
      const nextSameType = markers.slice(i + 1).find((x) => (x.e as MarkerEntry).type === marker.type);
      const start = m.at - EARLY_TOLERANCE_MS;
      const end = Math.min(m.at + MATCH_WINDOW_MS, nextSameType ? nextSameType.at : Infinity);
      const hit = candidates.find((c) => !used.has(c) && (c.e as GeofenceEntry).type === marker.type && c.at >= start && c.at < end);

      const base = { id: marker.id, session: sessionId, scenario: info.scenario, type: marker.type, markerAt: marker.t, via: marker.via };
      if (hit) {
        used.add(hit);
        results.push({ ...base, status: "detected", latencyS: Math.max(0, (hit.at - m.at) / 1000), eventAt: hit.e.t, cold: (hit.e as GeofenceEntry).cold });
      } else if (info.endedAt !== undefined) {
        // Sesión cerrada: "perdido" solo si el sistema tuvo un tiempo razonable; si no, el marcador queda cancelado.
        results.push({ ...base, status: info.endedAt - m.at >= MIN_WAIT_BEFORE_MISS_MS ? "missed" : "cancelled" });
      } else {
        results.push({ ...base, status: now - m.at < MATCH_WINDOW_MS ? "pending" : "missed" });
      }
    }
    for (const c of candidates) if (!used.has(c)) unmatched.push(c.e as GeofenceEntry);
  }
  return { results, unmatched, initial, restored, events, markersWithoutSession };
}

// Consumo: tramos entre lecturas consecutivas de batería, sin cargador en ambos extremos, agrupados por si la
// geocerca estaba activa. Es una estimación gruesa; el número fiable es el de Ajustes › Batería › Uso por app.
export function batteryRates(entries: SpikeEntry[]): BatteryResult[] {
  const withBattery = entries
    .filter((e) => typeof e.batteryLevel === "number" && e.charging === false)
    .sort(byTime);
  const acc = new Map<boolean, { hours: number; drop: number }>();

  for (let i = 1; i < withBattery.length; i++) {
    const a = withBattery[i - 1];
    const b = withBattery[i];
    // Nunca a través de una carga: entre a y b no puede haber ninguna lectura con cargador.
    const charged = entries.some((e) => e.charging === true && ms(e.t) > ms(a.t) && ms(e.t) < ms(b.t));
    const hours = (ms(b.t) - ms(a.t)) / 3_600_000;
    const drop = ((a.batteryLevel as number) - (b.batteryLevel as number)) * 100;
    // <15 min: demasiado ruido; drop<0: hubo carga no registrada; estado o perfil distintos: el tramo mezcla ambos.
    const sameConditions = (a.geofenceActive === true) === (b.geofenceActive === true) && (a.batteryProfile ?? "default") === (b.batteryProfile ?? "default");
    if (charged || hours < 0.25 || drop < 0 || !sameConditions) continue;
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
  const sorted = [...entries].sort(byTime);
  const { tagged, sessions } = tagSessions(sorted);
  const outcome = matchSessions(tagged, sessions, now);
  const { results, unmatched, initial, restored, events } = outcome;
  const sessionOf = new Map<SpikeEntry, string | null>(tagged.map((t) => [t.e, t.session]));
  const inSession = (id: string) => (g: GeofenceEntry) => sessionOf.get(g) === id;

  const sessionSummaries: SessionSummary[] = [...sessions.values()].map((info) => {
    const mine = results.filter((r) => r.session === info.id);
    const sessionEvents = events.filter(inSession(info.id));
    return {
      ...info,
      markers: mine.length,
      detected: mine.filter((r) => r.status === "detected").length,
      missed: mine.filter((r) => r.status === "missed").length,
      pending: mine.filter((r) => r.status === "pending").length,
      cancelled: mine.filter((r) => r.status === "cancelled").length,
      events: sessionEvents.length,
      initialEvents: initial.filter(inSession(info.id)).length,
      restoredEvents: restored.filter(inSession(info.id)).length,
      unmatchedEvents: unmatched.filter(inSession(info.id)).length,
      coldEvents: sessionEvents.filter((g) => g.cold).length,
    };
  });

  const scenarioIds = [...new Set(sessionSummaries.map((s) => s.scenario))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const scenarios: ScenarioSummary[] = scenarioIds.map((scenario) => {
    const sess = sessionSummaries.filter((s) => s.scenario === scenario);
    const mine = results.filter((r) => r.scenario === scenario);
    const detected = mine.filter((r) => r.status === "detected");
    const missed = mine.filter((r) => r.status === "missed").length;
    const enters = detected.filter((r) => r.type === "enter").map((r) => r.latencyS as number);
    const exits = detected.filter((r) => r.type === "exit").map((r) => r.latencyS as number);
    const resolved = detected.length + missed;
    return {
      scenario,
      sessions: sess.length,
      markers: mine.length,
      detected: detected.length,
      missed,
      pending: mine.filter((r) => r.status === "pending").length,
      cancelled: mine.filter((r) => r.status === "cancelled").length,
      detectionRate: resolved > 0 ? detected.length / resolved : null,
      enterLatenciesS: enters,
      exitLatenciesS: exits,
      medianEnterS: median(enters),
      medianExitS: median(exits),
      maxEnterS: enters.length ? Math.max(...enters) : null,
      maxExitS: exits.length ? Math.max(...exits) : null,
      events: sess.reduce((n, s) => n + s.events, 0),
      unmatchedEvents: sess.reduce((n, s) => n + s.unmatchedEvents, 0),
      coldEvents: sess.reduce((n, s) => n + s.coldEvents, 0),
    };
  });

  // Diagnóstico de qué dispara los eventos: ¿llegan solos o junto a una interacción tuya con el teléfono?
  const interactionTimes = tagged
    .filter((t) => INTERACTION_KINDS.has(t.e.kind))
    // En un cruce capturado después la interacción es la captura, no la hora del cruce.
    .map((t) => (t.e.kind === "marker" && t.e.via === "manual_time" && t.e.capturedAt ? ms(t.e.capturedAt) : t.at));
  const nearInteraction = (g: GeofenceEntry) => interactionTimes.some((it) => ms(g.t) - it >= 0 && ms(g.t) - it <= INTERACTION_WINDOW_MS);
  const diagnostics: Diagnostics = {
    events: events.length,
    foreground: events.filter((g) => g.appState === "active").length,
    cold: events.filter((g) => g.cold).length,
    afterInteraction: events.filter(nearInteraction).length,
    withLiveWatch: events.filter((g) => g.liveWatch === true).length,
  };

  const battery = batteryRates(sorted);
  const geofenceMissingCount = sorted.filter((e) => e.kind === "geofence_missing").length;

  const resolvedResults = results.filter((r) => r.status === "detected" || r.status === "missed");
  const detectedResults = results.filter((r) => r.status === "detected");
  const rate = resolvedResults.length ? detectedResults.length / resolvedResults.length : null;
  const enterLat = detectedResults.filter((r) => r.type === "enter").map((r) => r.latencyS as number);
  const exitLat = detectedResults.filter((r) => r.type === "exit").map((r) => r.latencyS as number);
  const on = battery.find((b) => b.geofenceActive);
  const off = battery.find((b) => !b.geofenceActive);
  const extraPerJourney = on?.pctPerHour != null && off?.pctPerHour != null ? (on.pctPerHour - off.pctPerHour) * CRITERIA.journeyHours : null;
  const firstAt = sorted[0]?.t ?? null;
  const lastAt = sorted.at(-1)?.t ?? null;
  const days = firstAt && lastAt ? Math.max(1, (ms(lastAt) - ms(firstAt)) / 86_400_000) : 1;
  const stationaryIds = new Set(sessionSummaries.filter((s) => s.scenario === "6" || s.scenario === "7").map((s) => s.id));
  const stationaryFalse = sessionSummaries.filter((s) => stationaryIds.has(s.id)).reduce((n, s) => n + s.unmatchedEvents, 0);

  const latencyVerdict = (type: string, values: number[], limitS: number): Verdict => {
    const max = values.length ? Math.max(...values) : 0;
    if (values.length === 0) return { criterion: `Latencia de ${type} ≤ ${fmtS(limitS)} (máx.)`, status: "nodata", detail: "sin datos" };
    return {
      criterion: `Latencia de ${type} ≤ ${fmtS(limitS)} (máx.)`,
      status: values.length < CRITERIA.minLatencySamples ? "insufficient" : max <= limitS ? "ok" : "fail",
      detail: `máx. ${fmtS(max)} (n=${values.length}${values.length < CRITERIA.minLatencySamples ? `, hacen falta ≥ ${CRITERIA.minLatencySamples}` : ""})`,
    };
  };

  const verdict: Verdict[] = [
    {
      criterion: "≥ 90 % de entradas y salidas detectadas",
      status:
        rate == null
          ? "nodata"
          : resolvedResults.length < CRITERIA.minDetectionSamples
            ? "insufficient"
            : rate >= CRITERIA.detectionRate
              ? "ok"
              : "fail",
      detail:
        rate == null
          ? "sin marcadores resueltos"
          : `${detectedResults.length}/${resolvedResults.length} (${(rate * 100).toFixed(0)} %)${resolvedResults.length < CRITERIA.minDetectionSamples ? `, hacen falta ≥ ${CRITERIA.minDetectionSamples} marcadores resueltos` : ""}`,
    },
    latencyVerdict("entrada", enterLat, CRITERIA.enterLatencyS),
    latencyVerdict("salida", exitLat, CRITERIA.exitLatencyS),
    {
      criterion: "≤ 1 transición falsa por día quieto (escenarios 6 y 7)",
      status: stationaryIds.size ? (stationaryFalse / days <= CRITERIA.falsePerDay ? "ok" : "fail") : "nodata",
      detail: stationaryIds.size ? `${stationaryFalse} eventos sin marcador en ${days.toFixed(1)} día(s)` : "sin datos de escenarios 6/7",
    },
    {
      criterion: `Batería ≤ ${CRITERIA.batteryPctPerJourney} % por jornada (${CRITERIA.journeyHours} h)`,
      status: extraPerJourney == null ? "nodata" : extraPerJourney <= CRITERIA.batteryPctPerJourney ? "ok" : "fail",
      detail: extraPerJourney == null ? "faltan tramos con y sin geocerca" : `≈ ${extraPerJourney.toFixed(1)} % extra por jornada (estimación gruesa)`,
    },
  ];

  return {
    firstAt,
    lastAt,
    totalEntries: sorted.length,
    sessions: sessionSummaries,
    markerResults: results,
    scenarios,
    battery,
    diagnostics,
    geofenceMissingCount,
    initialTriggerEvents: initial.length,
    restoredEvents: restored.length,
    markersWithoutSession: outcome.markersWithoutSession,
    verdict,
  };
}

export function fmtS(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Hora local legible, para que quien lee el reporte la relacione con lo que vivió.
export function fmtLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const fmtClock = (iso: string) => fmtLocal(iso).slice(11);

export const VERDICT_TAGS: Record<VerdictStatus, string> = { ok: "OK", fail: "FALLA", insufficient: "POCOS DATOS", nodata: "?" };

const STATUS_LABELS: Record<MarkerStatus, string> = { detected: "detectado", missed: "perdido", pending: "pendiente", cancelled: "cancelado (sesión cerrada antes de tiempo)" };

export function summaryText(summary: Summary): string {
  const lines: string[] = ["# Resumen del spike de geofencing", ""];
  lines.push(`Entradas de log: ${summary.totalEntries}  |  ${summary.firstAt ?? "—"} → ${summary.lastAt ?? "—"}`);
  if (summary.geofenceMissingCount) lines.push(`⚠ La geocerca había desaparecido del sistema ${summary.geofenceMissingCount} vez/veces (ver "geofence_missing").`);
  if (summary.initialTriggerEvents) lines.push(`Eventos inmediatos tras registrar la geocerca (estado actual, no un cruce; no se emparejan con marcadores ni cuentan como falsos): ${summary.initialTriggerEvents}`);
  if (summary.restoredEvents) {
    lines.push(
      `Eventos por re-registro (al abrir la app desde cero, o repetidos a ≤ 10 s: Expo vuelve a registrar la geocerca y Android informa el estado actual; no son una detección): ${summary.restoredEvents}`
    );
  }
  if (summary.markersWithoutSession) lines.push(`⚠ Marcadores hechos sin sesión activa (ignorados): ${summary.markersWithoutSession}`);

  lines.push("", "## Criterios");
  for (const v of summary.verdict) lines.push(`- [${VERDICT_TAGS[v.status]}] ${v.criterion}: ${v.detail}`);

  lines.push("", "## Sesiones (cada geocerca registrada; nada se mezcla entre ellas)");
  if (summary.sessions.length === 0) lines.push("- ninguna");
  for (const s of summary.sessions) {
    const span = `${fmtClock(new Date(s.startedAt).toISOString())} → ${s.endedAt ? fmtClock(new Date(s.endedAt).toISOString()) : "abierta"}${s.endReason ? ` (${s.endReason})` : ""}`;
    const flags = [s.legacy ? "inferida de un log anterior" : null, s.batteryCheckOverridden ? "⚠ verificación de batería FORZADA" : null, s.batteryOptimization === true ? "optimización de batería activa" : s.batteryOptimization === false ? "sin optimización de batería" : null].filter(Boolean);
    lines.push(
      `- ${s.id} · esc.${s.scenario} · perfil ${s.batteryProfile}${s.radius ? ` · r=${s.radius} m` : ""} · ${span}${flags.length ? ` · ${flags.join(" · ")}` : ""}`,
      `    marcadores ${s.markers} (detectados ${s.detected}, perdidos ${s.missed}, pendientes ${s.pending}, cancelados ${s.cancelled}) · eventos ${s.events} (iniciales ${s.initialEvents}, re-registros ${s.restoredEvents}, sin marcador ${s.unmatchedEvents}, en frío ${s.coldEvents})`
    );
  }

  lines.push("", "## Por escenario (suma de sus sesiones)");
  for (const s of summary.scenarios) {
    lines.push(
      `- Esc. ${s.scenario}: ${s.sessions} sesión(es) · marcadores ${s.markers} (detectados ${s.detected}, perdidos ${s.missed}, pendientes ${s.pending}, cancelados ${s.cancelled}) · ` +
        `entrada med/máx ${fmtS(s.medianEnterS)}/${fmtS(s.maxEnterS)} · salida med/máx ${fmtS(s.medianExitS)}/${fmtS(s.maxExitS)} · ` +
        `eventos ${s.events} (en frío ${s.coldEvents}, sin marcador ${s.unmatchedEvents})`
    );
  }

  const d = summary.diagnostics;
  lines.push("", "## Diagnóstico: ¿qué dispara los eventos?");
  lines.push(`- Eventos reales (sin los iniciales): ${d.events}`);
  lines.push(`- Con la app en primer plano: ${d.foreground} · en frío (app cerrada): ${d.cold}`);
  lines.push(`- A ≤ 10 s de una interacción tuya con el teléfono: ${d.afterInteraction} · con el panel en vivo pidiendo ubicación: ${d.withLiveWatch}`);
  lines.push("  (Si casi todos llegan junto a una interacción o con el panel encendido, el sistema podría estar esperando a que algo pida ubicación.)");

  lines.push("", "## Batería (estimación gruesa por snapshots; el dato fiable es Ajustes › Batería)");
  if (summary.battery.length === 0) lines.push("- sin tramos válidos (necesita ≥2 snapshots sin cargador, ≥15 min entre ellos y las mismas condiciones)");
  for (const b of summary.battery) {
    lines.push(`- geocerca ${b.geofenceActive ? "ACTIVA" : "inactiva"}: ${b.dropPct.toFixed(1)} % en ${b.hours.toFixed(1)} h = ${b.pctPerHour?.toFixed(2) ?? "—"} %/h`);
  }

  lines.push("", "## Marcadores");
  if (summary.markerResults.length === 0) lines.push("- ninguno");
  for (const r of summary.markerResults) {
    const via = r.via === "manual_time" ? " [hora capturada]" : r.via === "notification" ? " [notificación]" : "";
    lines.push(`- ${fmtLocal(r.markerAt)} ${r.session} esc.${r.scenario} ${r.type}${via}: ${STATUS_LABELS[r.status]}${r.latencyS != null ? ` (+${fmtS(r.latencyS)}${r.cold ? ", en frío" : ""})` : ""}`);
  }
  return lines.join("\n");
}

// El último marcador que sigue vigente (no deshecho), en el orden en que se escribió en el log: es el que
// "Deshacer" anula y el que la notificación fija muestra como último.
export function lastActiveMarker(entries: SpikeEntry[]): MarkerEntry | null {
  const undone = undoneMarkers(entries);
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "marker" && !undone(e)) return e;
  }
  return null;
}
