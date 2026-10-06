import { describe, expect, it } from "vitest";
import { FIELD_LOG_2026_10_05, FIELD_LOG_EXPORTED_AT } from "./__fixtures__/fieldLog20261005";
import { batteryRates, fmtS, lastActiveMarker, median, sessionAt, summarize, summaryText, type SpikeEntry } from "./analysis";

const T0 = Date.parse("2026-10-10T15:00:00Z");
const at = (min: number, s = 0) => new Date(T0 + min * 60_000 + s * 1000).toISOString();
const NOW = T0 + 6 * 3_600_000; // mucho después: nada queda "pendiente" salvo que se pida

const ctx = (session: string | null, scenario = "3") => ({ session, scenario, batteryProfile: "default", geofenceActive: session !== null });
const start = (t: string, session: string, extra: Record<string, unknown> = {}) =>
  ({ kind: "session_start", t, radius: 100, ...ctx(session, (extra.scenario as string) ?? "3"), ...extra }) as SpikeEntry;
const end = (t: string, session: string, reason = "unregister") => ({ kind: "session_end", t, reason, ...ctx(session) }) as SpikeEntry;
const ev = (t: string, type: "enter" | "exit", session: string, extra: Record<string, unknown> = {}) =>
  ({ kind: "geofence", t, type, appState: "background", jsUptimeMs: 900, cold: true, ...ctx(session), ...extra }) as SpikeEntry;
let markerSeq = 0;
const mk = (t: string, type: "enter" | "exit", session: string | null, extra: Record<string, unknown> = {}) =>
  ({ kind: "marker", t, type, id: `m${++markerSeq}`, via: "app", ...ctx(session), ...extra }) as SpikeEntry;

describe("log real de la primera prueba de campo", () => {
  const summary = summarize(FIELD_LOG_2026_10_05, FIELD_LOG_EXPORTED_AT);

  it("ya no da por detectado un marcador que solo coincide con el Enter inicial de otra geocerca", () => {
    expect(summary.markerResults.map((r) => r.status)).toEqual(["cancelled", "pending"]);
    expect(summary.markerResults.some((r) => r.status === "detected")).toBe(false);
  });

  it("separa las dos geocercas en dos sesiones y aparta los dos eventos iniciales", () => {
    expect(summary.sessions.map((s) => s.id)).toEqual(["legacy-1", "legacy-2"]);
    expect(summary.initialTriggerEvents).toBe(2);
    expect(summary.sessions[0]).toMatchObject({ events: 1, initialEvents: 1, unmatchedEvents: 1 });
  });

  it("no emite veredictos engañosos con una muestra de cero", () => {
    expect(summary.verdict.every((v) => v.status === "nodata")).toBe(true);
  });

  it("deja a la vista el diagnóstico: el único evento real llegó con la app abierta y junto a una interacción", () => {
    expect(summary.diagnostics).toEqual({ events: 1, foreground: 1, cold: 0, afterInteraction: 1, withLiveWatch: 0 });
  });

  it("el texto del resumen no menciona latencias inventadas", () => {
    const text = summaryText(summary);
    expect(text).not.toContain("+26 s");
    expect(text).toContain("cancelado");
    expect(text).toContain("legacy-2");
  });
});

describe("emparejamiento de marcadores y eventos", () => {
  it("mide la latencia de entradas y salidas de una misma sesión", () => {
    const entries = [
      start(at(0), "S1"),
      mk(at(1), "exit", "S1"), ev(at(2, 30), "exit", "S1"),
      mk(at(10), "enter", "S1"), ev(at(14), "enter", "S1"),
    ];
    const results = summarize(entries, NOW).markerResults;
    expect(results.map((r) => [r.type, r.status, r.latencyS])).toEqual([
      ["exit", "detected", 90],
      ["enter", "detected", 240],
    ]);
  });

  it("acepta un evento unos segundos ANTES del toque (sin latencia negativa)", () => {
    const results = summarize([start(at(0), "S1"), mk(at(5), "exit", "S1"), ev(at(4, 30), "exit", "S1")], NOW).markerResults;
    expect(results[0]).toMatchObject({ status: "detected", latencyS: 0 });
  });

  it("un evento no puede servir a dos marcadores: va al más cercano", () => {
    const results = summarize([start(at(0), "S1"), mk(at(1), "enter", "S1"), mk(at(3), "enter", "S1"), ev(at(4), "enter", "S1")], NOW).markerResults;
    expect(results.map((r) => r.status)).toEqual(["missed", "detected"]);
  });

  it("el Enter inicial tras registrar NUNCA se empareja con un marcador (bug del 2026-10-05)", () => {
    const entries = [
      start(at(0), "S1"),
      mk(at(5), "enter", "S1"), // tocado por error 17 s antes de cerrar la sesión
      end(at(5, 17), "S1"),
      start(at(5, 26), "S2"),
      ev(at(5, 26.2), "enter", "S2", { initial: true }),
    ];
    const summary = summarize(entries, NOW);
    expect(summary.markerResults[0].status).toBe("cancelled");
    expect(summary.initialTriggerEvents).toBe(1);
  });

  it("detecta el evento inicial por tiempo aunque el log no lo marque", () => {
    const entries = [start(at(0), "S1"), mk(at(0, -20), "enter", "S1"), ev(at(0, 0.3), "enter", "S1")];
    const summary = summarize(entries, NOW);
    expect(summary.initialTriggerEvents).toBe(1);
    expect(summary.markerResults[0].status).not.toBe("detected");
  });

  it("registrar estando FUERA da un Exit inicial (Expo pide INITIAL_TRIGGER_EXIT): tampoco se empareja", () => {
    const entries = [start(at(0), "S1"), mk(at(0, -10), "exit", "S1"), ev(at(0, 0.4), "exit", "S1")];
    const summary = summarize(entries, NOW);
    expect(summary.initialTriggerEvents).toBe(1);
    expect(summary.markerResults[0].status).not.toBe("detected");
  });

  it("un Enter real poco después del inicio (más de 15 s) sí cuenta", () => {
    const entries = [start(at(0), "S1"), mk(at(0, 30), "enter", "S1"), ev(at(1, 10), "enter", "S1")];
    expect(summarize(entries, NOW).markerResults[0]).toMatchObject({ status: "detected", latencyS: 40 });
  });

  it("no mezcla sesiones: un marcador de S1 no se empareja con un evento de S2", () => {
    const entries = [
      start(at(0), "S1"),
      mk(at(1), "exit", "S1"),
      end(at(13), "S1"),
      start(at(14), "S2"),
      ev(at(15), "exit", "S2"),
    ];
    const summary = summarize(entries, NOW);
    expect(summary.markerResults[0]).toMatchObject({ session: "S1", status: "missed" });
    expect(summary.sessions.find((s) => s.id === "S2")?.unmatchedEvents).toBe(1);
  });

  it("sesión cerrada sin evento: cancelado si pasaron menos de 10 min, perdido si pasaron más", () => {
    const short = summarize([start(at(0), "S1"), mk(at(1), "exit", "S1"), end(at(9), "S1")], NOW).markerResults[0];
    const long = summarize([start(at(0), "S1"), mk(at(1), "exit", "S1"), end(at(12), "S1")], NOW).markerResults[0];
    expect(short.status).toBe("cancelled");
    expect(long.status).toBe("missed");
  });

  it("en una sesión abierta: pendiente hasta 30 min, perdido después", () => {
    const entries = [start(at(0), "S1"), mk(at(1), "exit", "S1")];
    expect(summarize(entries, T0 + 20 * 60_000).markerResults[0].status).toBe("pending");
    expect(summarize(entries, T0 + 40 * 60_000).markerResults[0].status).toBe("missed");
  });

  it("los marcadores sin sesión se cuentan aparte y no entran en ningún resultado", () => {
    const summary = summarize([mk(at(1), "exit", null)], NOW);
    expect(summary.markersWithoutSession).toBe(1);
    expect(summary.markerResults).toEqual([]);
  });
});

describe("re-registros: abrir la app desde cero no es una detección", () => {
  it("un evento marcado como re-registro no hace pasar por detectado un cruce que se perdió (el riesgo del escenario 3)", () => {
    const entries = [
      start(at(0), "S3", { scenario: "3" }),
      mk(at(5), "exit", "S3"), // cruzaste afuera con la app cerrada y el sistema no avisó
      ev(at(25), "exit", "S3", { restored: true, appState: "active", cold: true }), // al abrir la app Expo re-registra
    ];
    const summary = summarize(entries, NOW);
    expect(summary.markerResults[0].status).toBe("missed");
    expect(summary.restoredEvents).toBe(1);
    expect(summary.sessions[0]).toMatchObject({ events: 0, restoredEvents: 1, unmatchedEvents: 0 });
  });

  it("un evento repetido del mismo tipo a ≤ 10 s es un re-registro (el evento real despertó la app y Expo la registró otra vez)", () => {
    const entries = [start(at(0), "S3", { scenario: "3" }), mk(at(5), "exit", "S3"), ev(at(6), "exit", "S3"), ev(at(6, 1.5), "exit", "S3")];
    const summary = summarize(entries, NOW);
    expect(summary.markerResults[0]).toMatchObject({ status: "detected", latencyS: 60 });
    expect(summary.sessions[0]).toMatchObject({ events: 1, restoredEvents: 1, unmatchedEvents: 0 });
  });

  it("eventos que alternan enter/exit, aunque sean cercanos, son cruces distintos", () => {
    const entries = [start(at(0), "S1"), ev(at(5), "exit", "S1"), ev(at(5, 4), "enter", "S1")];
    expect(summarize(entries, NOW).restoredEvents).toBe(0);
  });

  it("el mismo tipo separado por más de 10 s sí cuenta como evento aparte", () => {
    const entries = [start(at(0), "S1"), ev(at(5), "exit", "S1"), ev(at(5, 11), "exit", "S1")];
    const summary = summarize(entries, NOW);
    expect(summary.restoredEvents).toBe(0);
    expect(summary.sessions[0].events).toBe(2);
  });

  it("los re-registros no cuentan como transiciones falsas en los escenarios 6 y 7", () => {
    const entries = [start(at(0), "S6", { scenario: "6" }), ev(at(300), "exit", "S6", { restored: true, appState: "active", cold: true })];
    const summary = summarize(entries, NOW);
    expect(summary.verdict[3]).toMatchObject({ status: "ok" });
    expect(summary.diagnostics.events).toBe(0);
  });

  it("el resumen en texto explica los re-registros", () => {
    const entries = [start(at(0), "S3", { scenario: "3" }), ev(at(25), "enter", "S3", { restored: true })];
    expect(summaryText(summarize(entries, NOW))).toContain("re-registro");
  });
});

describe("deshacer y capturar después", () => {
  it("un marcador deshecho (por id) se ignora", () => {
    const wrong = mk(at(1), "exit", "S1", { id: "oops" });
    const entries = [start(at(0), "S1"), wrong, { kind: "marker_undo", t: at(1, 5), markerId: "oops", ...ctx("S1") } as SpikeEntry];
    expect(summarize(entries, NOW).markerResults).toEqual([]);
  });

  it("un marcador antiguo sin id se deshace por su hora", () => {
    const legacy = { kind: "marker", t: at(1), type: "exit", ...ctx("S1") } as SpikeEntry;
    const entries = [start(at(0), "S1"), legacy, { kind: "marker_undo", t: at(2), markerT: at(1), ...ctx("S1") } as SpikeEntry];
    expect(summarize(entries, NOW).markerResults).toEqual([]);
  });

  it("un cruce capturado después usa la hora real del cruce, no la de la captura", () => {
    const entries = [
      start(at(0), "S1"),
      ev(at(10, 20), "exit", "S1"),
      mk(at(10), "exit", "S1", { via: "manual_time", capturedAt: at(480) }), // capturado 8 h después
    ];
    const summary = summarize(entries, NOW);
    expect(summary.markerResults[0]).toMatchObject({ status: "detected", latencyS: 20, via: "manual_time" });
    // La interacción fue la captura (8 h después), así que el evento NO llegó junto a una interacción.
    expect(summary.diagnostics.afterInteraction).toBe(0);
  });

  it("sessionAt encuentra la sesión abierta a una hora, también con captura posterior al cierre", () => {
    const entries = [start(at(0), "S1"), end(at(30), "S1"), start(at(40), "S2")];
    expect(sessionAt(entries, T0 + 10 * 60_000)?.id).toBe("S1");
    expect(sessionAt(entries, T0 + 35 * 60_000)).toBeNull();
    expect(sessionAt(entries, T0 + 50 * 60_000)?.id).toBe("S2");
  });
});

describe("veredictos", () => {
  const detectedExits = (n: number, latencyS = 60) => {
    const entries: SpikeEntry[] = [start(at(0), "S1")];
    for (let i = 0; i < n; i++) entries.push(mk(at(1 + i * 20), "exit", "S1"), ev(at(1 + i * 20, latencyS), "exit", "S1"));
    return entries;
  };

  it("una muestra pequeña es 'pocos datos', no 'OK'", () => {
    const v = summarize(detectedExits(1), NOW).verdict;
    expect(v[0].status).toBe("insufficient");
    expect(v[2].status).toBe("insufficient");
  });

  it("con muestra suficiente: OK si cumple y FALLA si no", () => {
    const good = summarize(detectedExits(5), NOW).verdict;
    expect(good[0].status).toBe("ok");
    expect(good[2].status).toBe("ok");
    const slow = summarize(detectedExits(5, 400), NOW).verdict;
    expect(slow[2].status).toBe("fail"); // salida > 5 min
  });

  it("4 de 5 detectados (80 %) falla el 90 %", () => {
    const entries = [...detectedExits(4), mk(at(100), "exit", "S1")];
    const v = summarize(entries, NOW).verdict;
    expect(v[0]).toMatchObject({ status: "fail" });
  });

  it("los eventos sin marcador cuentan como falsos solo en los escenarios 6 y 7", () => {
    const entries = [start(at(0), "S6", { scenario: "6" }), ev(at(0, 1), "enter", "S6", { initial: true }), ev(at(300), "exit", "S6"), ev(at(400), "enter", "S6")];
    const stationary = summarize(entries, NOW).verdict[3];
    expect(stationary.status).toBe("fail"); // 2 falsos en 1 día
    const other = summarize([start(at(0), "S3"), ev(at(300), "exit", "S3"), ev(at(400), "enter", "S3")], NOW).verdict[3];
    expect(other.status).toBe("nodata");
  });

  it("un log vacío no revienta y no da veredicto", () => {
    const empty = summarize([], NOW);
    expect(empty.totalEntries).toBe(0);
    expect(empty.verdict.every((v) => v.status === "nodata")).toBe(true);
  });
});

describe("diagnóstico de qué dispara los eventos", () => {
  it("cuenta eventos en primer plano, en frío, tras una interacción y con el panel en vivo", () => {
    const entries = [
      start(at(0), "S1"),
      { kind: "app_open", t: at(10), ...ctx("S1") } as SpikeEntry,
      ev(at(10, 4), "exit", "S1", { appState: "active", cold: false, liveWatch: true }), // 4 s tras abrir la app
      ev(at(40), "enter", "S1", { appState: "background", cold: true }), // solo
    ];
    expect(summarize(entries, NOW).diagnostics).toEqual({ events: 2, foreground: 1, cold: 1, afterInteraction: 1, withLiveWatch: 1 });
  });

  it("un evento a más de 10 s de la interacción no cuenta como disparado por ella", () => {
    const entries = [start(at(0), "S1"), { kind: "app_open", t: at(10), ...ctx("S1") } as SpikeEntry, ev(at(10, 11), "exit", "S1")];
    expect(summarize(entries, NOW).diagnostics.afterInteraction).toBe(0);
  });
});

describe("batería", () => {
  const bat = (min: number, level: number, geofenceActive: boolean, extra: Record<string, unknown> = {}) =>
    ({ kind: "snapshot", t: at(min), batteryLevel: level, charging: false, scenario: "9", batteryProfile: "default", geofenceActive, ...extra }) as SpikeEntry;

  it("calcula la tasa con y sin geocerca y no mezcla tramos que cruzan el cambio de estado", () => {
    const rates = batteryRates([bat(0, 1.0, true), bat(360, 0.9, true), bat(400, 0.9, false), bat(760, 0.84, false)]);
    expect(rates.find((r) => r.geofenceActive)?.pctPerHour).toBeCloseTo(10 / 6, 9);
    expect(rates.find((r) => !r.geofenceActive)?.pctPerHour).toBeCloseTo(6 / 6, 9);
  });

  it("descarta tramos con una carga en medio y tramos de menos de 15 min", () => {
    expect(batteryRates([bat(0, 0.5, true), bat(60, 0.8, true, { charging: true }), bat(120, 0.7, true)])).toEqual([]);
    expect(batteryRates([bat(0, 0.9, true), bat(10, 0.88, true)])).toEqual([]);
  });

  it("no mezcla perfiles de batería distintos", () => {
    expect(batteryRates([bat(0, 1, true), bat(120, 0.9, true, { batteryProfile: "unrestricted" })])).toEqual([]);
  });
});

describe("utilidades", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("fmtS muestra minutos enteros sin decimales", () => {
    expect(fmtS(45)).toBe("45 s");
    expect(fmtS(180)).toBe("3 min");
    expect(fmtS(150)).toBe("2.5 min");
    expect(fmtS(null)).toBe("—");
  });
});

describe("último marcador vigente", () => {
  it("devuelve el último escrito que no se haya deshecho", () => {
    const a = mk(at(1), "exit", "S1", { id: "a" });
    const b = mk(at(2), "enter", "S1", { id: "b" });
    const undoB = { kind: "marker_undo", t: at(3), markerId: "b", ...ctx("S1") } as SpikeEntry;
    expect(lastActiveMarker([a, b])).toBe(b);
    expect(lastActiveMarker([a, b, undoB])).toBe(a);
    expect(lastActiveMarker([])).toBeNull();
  });

  it("usa el orden de escritura: un cruce capturado después es el último aunque su hora sea anterior", () => {
    const real = mk(at(30), "exit", "S1", { id: "real" });
    const late = mk(at(10), "enter", "S1", { id: "late", via: "manual_time", capturedAt: at(40) });
    expect(lastActiveMarker([real, late])?.id).toBe("late");
  });
});
