// Panel en vivo del laboratorio: distancia al centro, radio, dentro/fuera según el GPS, precisión y cuánto
// falta para cruzar "con margen". Solo con la app abierta; ver liveWatcher.ts sobre cómo afecta la medición.

import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, Switch, Text, View } from "react-native";
import { fmtClock } from "../analysis";
import { bearingDeg, cardinal, distanceM, fmtM, gaugePosition, guidance, type LatLon } from "../geo";
import { startLiveWatch, type LiveFix } from "../liveWatcher";
import { colors } from "../../ui";
import { spikeColors } from "./common";

interface Props {
  center: LatLon | null;
  radius: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  canUseLocation: boolean;
  lastEvent: { type: "enter" | "exit"; at: string; initial: boolean } | null;
  pendingMarker: { type: "enter" | "exit"; at: string } | null;
}

const typeLabel = (type: "enter" | "exit") => (type === "enter" ? "ENTRADA" : "SALIDA");

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 90 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
}

export default function LivePanel({ center, radius, enabled, onToggle, canUseLocation, lastEvent, pendingMarker }: Props) {
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => sub.remove();
  }, []);

  // Solo pide ubicación con el panel encendido, la app abierta y el permiso concedido.
  const running = enabled && appActive && canUseLocation;
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    setError(null);
    setFix(null);
    startLiveWatch(
      (next) => !cancelled && setFix(next),
      (message) => !cancelled && setError(message)
    )
      .then((stopFn) => {
        if (cancelled) stopFn();
        else stop = stopFn;
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [running]);

  // Reloj para los "hace N s" (también del último evento) y para avisar de un GPS viejo.
  useEffect(() => {
    if (!appActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [appActive]);

  const here: LatLon | null = fix ? { latitude: fix.latitude, longitude: fix.longitude } : null;
  const distance = here && center ? distanceM(here, center) : null;
  const g = distance != null ? guidance(distance, radius, fix?.accuracy ?? null) : null;
  const sideColor = g ? spikeColors[g.side] : colors.muted;
  const fixAgeMs = fix ? now - fix.at : 0;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>EN VIVO</Text>
        <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: colors.primary }} />
      </View>

      {!enabled ? (
        <Text style={styles.hint}>
          Apagado. Enciéndelo para ver tu distancia al borde. Usa GPS y mantiene la pantalla encendida; al salir de la app se detiene solo.
          Ojo: mientras está encendido la app pide ubicación, y eso puede acelerar la detección del sistema (queda marcado en el log).
        </Text>
      ) : !canUseLocation ? (
        <Text style={styles.warn}>Falta el permiso de ubicación. Concédelo en la sección 1.</Text>
      ) : !appActive ? null : error ? (
        <Text style={styles.warn}>{error}</Text>
      ) : !fix ? (
        <Text style={styles.hint}>Buscando señal GPS…</Text>
      ) : (
        <>
          {g && center && here && distance != null ? (
            <>
              <Text style={[styles.headline, { color: sideColor }]}>{g.headline}</Text>
              <View style={styles.numbers}>
                <Text style={styles.number}>{fmtM(distance)} m al centro</Text>
                <Text style={styles.number}>radio {radius} m</Text>
                <Text style={[styles.number, g.poorAccuracy && styles.warn]}>GPS ±{fix.accuracy != null ? fmtM(fix.accuracy) : "?"} m</Text>
              </View>
              <Text style={styles.hint}>
                {g.side === "inside" ? "DENTRO" : g.side === "outside" ? "FUERA" : "INCIERTO"} según el GPS · el centro está al{" "}
                {cardinal(bearingDeg(here, center))} ({Math.round(bearingDeg(here, center))}°)
              </Text>
              <View style={styles.gauge}>
                <View style={styles.gaugeInside} />
                <View style={styles.gaugeEdge} />
                <View style={[styles.gaugeDot, { left: `${gaugePosition(distance, radius) * 100}%`, backgroundColor: sideColor }]} />
              </View>
              <View style={styles.gaugeLabels}>
                <Text style={styles.gaugeLabel}>centro</Text>
                <Text style={styles.gaugeLabel}>borde · {radius} m</Text>
                <Text style={styles.gaugeLabel}>{radius * 2} m</Text>
              </View>
              {g.hints.map((hint) => (
                <Text key={hint} style={styles.guide}>
                  {hint}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.hint}>
              GPS ±{fix.accuracy != null ? fmtM(fix.accuracy) : "?"} m. Define el centro («Usar mi ubicación como centro») para ver la distancia al borde.
            </Text>
          )}
          {fixAgeMs > 5000 ? <Text style={styles.warn}>Señal GPS vieja ({ago(fixAgeMs)}): parece que se perdió.</Text> : null}
        </>
      )}

      <View style={styles.events}>
        <Text style={styles.eventLine}>
          Último evento del sistema:{" "}
          {lastEvent
            ? `${lastEvent.initial ? "estado inicial (" : ""}${typeLabel(lastEvent.type)}${lastEvent.initial ? ")" : ""} a las ${fmtClock(lastEvent.at)} (${ago(now - new Date(lastEvent.at).getTime())})`
            : "ninguno todavía"}
        </Text>
        {pendingMarker ? (
          <Text style={[styles.eventLine, styles.pending]}>
            Esperando que el sistema detecte tu {typeLabel(pendingMarker.type)} marcada a las {fmtClock(pendingMarker.at)} ({ago(now - new Date(pendingMarker.at).getTime())})
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "white", borderRadius: 12, padding: 14, gap: 8, borderWidth: 2, borderColor: colors.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 13, fontWeight: "800", color: colors.primary, letterSpacing: 1 },
  headline: { fontSize: 22, fontWeight: "800" },
  numbers: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  number: { fontSize: 14, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  warn: { fontSize: 12, color: colors.warningText, lineHeight: 17 },
  guide: { fontSize: 13, color: colors.text, lineHeight: 18 },
  gauge: { height: 14, borderRadius: 7, backgroundColor: "#FCEBEB", marginTop: 4, justifyContent: "center" },
  gaugeInside: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", backgroundColor: "#EAF3DE", borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  gaugeEdge: { position: "absolute", left: "50%", top: -3, bottom: -3, width: 3, backgroundColor: colors.text, marginLeft: -1 },
  gaugeDot: { position: "absolute", width: 18, height: 18, borderRadius: 9, marginLeft: -9, borderWidth: 2, borderColor: "white" },
  gaugeLabels: { flexDirection: "row", justifyContent: "space-between" },
  gaugeLabel: { fontSize: 10, color: colors.muted },
  events: { gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 },
  eventLine: { fontSize: 12, color: colors.text, lineHeight: 17 },
  pending: { color: colors.warningText, fontWeight: "600" },
});
