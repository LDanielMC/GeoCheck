// Laboratorio del spike de geofencing: solo en el dispositivo, sin backend ni login.
// Se muestra cuando EXPO_PUBLIC_SPIKE=1 (ver App.tsx y el perfil "spike" de eas.json).

import React, { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Sharing from "expo-sharing";
import { fmtLocal, summarize, summaryText, type SpikeEntry } from "../spike/analysis";
import * as lab from "../spike/geofenceLab";
import { BATTERY_PROFILES, SCENARIOS } from "../spike/scenarios";
import { appendLog, clearLog, readConfig, readLog, writeConfig, writeExportFile, type SpikeConfig } from "../spike/spikeStorage";
import { Button, colors, ErrorText } from "../ui";

const RADII = [100, 150, 200];
const MARKER_LOCK_MS = 10_000; // evita contar dos veces un doble toque

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="button">
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const Row = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, warn && styles.warn]}>{value}</Text>
  </View>
);

export default function GeofenceLabScreen() {
  const [config, setConfig] = useState<SpikeConfig>(() => readConfig());
  const [status, setStatus] = useState<lab.LabStatus | null>(null);
  const [entries, setEntries] = useState<SpikeEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingWarning, setMissingWarning] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, forceTick] = useState(0);
  const [note, setNote] = useState("");
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setConfig(readConfig());
    setEntries(readLog());
    setStatus(await lab.getStatus());
  }, []);

  // Al abrir (y al volver a primer plano): deja constancia del estado y detecta si el sistema borró la geocerca.
  useEffect(() => {
    let cancelled = false;
    const onOpen = async () => {
      const { missing } = await lab.checkRegistration();
      if (!cancelled) {
        setMissingWarning(missing);
        await reload();
      }
    };
    void onOpen();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void onOpen();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [reload]);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      await appendLog({ kind: "error", where: name, message });
    } finally {
      setBusy(null);
      await reload();
    }
  };

  const update = (patch: Partial<SpikeConfig>) => setConfig(writeConfig(patch));

  const useMyLocation = () =>
    run("ubicación", async () => {
      const { accuracy, ...center } = await lab.currentPosition();
      setFixAccuracy(accuracy);
      update({ center });
    });

  const marker = (type: "enter" | "exit") => {
    void appendLog({ kind: "marker", type }).then(reload);
    setLockedUntil(Date.now() + MARKER_LOCK_MS);
    setTimeout(() => forceTick((n) => n + 1), MARKER_LOCK_MS + 50);
  };
  const locked = Date.now() < lockedUntil;

  const exportLog = () =>
    run("exportar", async () => {
      const all = readLog();
      const device = {
        platform: Platform.OS,
        constants: Platform.constants,
        exportedAt: new Date().toISOString(),
        config: readConfig(),
      };
      const file = writeExportFile(summaryText(summarize(all)), all, device);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Compartir no está disponible en este dispositivo.");
      await Sharing.shareAsync(file.uri, { mimeType: "text/plain", dialogTitle: "Exportar log del spike" });
    });

  const confirmClear = () =>
    Alert.alert("Borrar el log", "Se borran todas las entradas del spike en este teléfono. ¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          clearLog();
          void reload();
        },
      },
    ]);

  const summary = summarize(entries);
  const lastMarker = [...entries].reverse().find((e) => e.kind === "marker");
  const recent = [...entries].reverse().slice(0, 12);
  const scenario = SCENARIOS.find((s) => s.id === config.scenario);
  const bgOk = status?.background === "granted";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Laboratorio de geofencing</Text>
      <Text style={styles.muted}>Spike: todo se guarda solo en este teléfono. No requiere sesión ni servidor.</Text>

      {missingWarning ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            El sistema eliminó la geocerca desde la última vez (reinicio, ahorro de batería u otra causa). Quedó registrado en el log.
            Vuelve a registrarla abajo.
          </Text>
        </View>
      ) : null}

      <Section title="1. Permisos y sistema">
        <Row label="Ubicación en primer plano" value={`${status?.foreground ?? "…"} (${status?.foregroundAccuracy ?? "…"})`} warn={status?.foregroundAccuracy === "coarse"} />
        <Row label="Permitir todo el tiempo" value={status?.background ?? "…"} warn={!!status && !bgOk} />
        <Row label="Servicios de ubicación" value={status ? (status.servicesEnabled ? "activos" : "APAGADOS") : "…"} warn={status?.servicesEnabled === false} />
        <Row label="Optimización de batería" value={status?.batteryOptimization == null ? "desconocido" : status.batteryOptimization ? "activa (puede restringir)" : "sin restricciones"} />
        <Row label="Ahorro de batería del sistema" value={status?.lowPowerMode == null ? "desconocido" : status.lowPowerMode ? "ACTIVO" : "apagado"} />
        <Row label="Geocerca registrada en el sistema" value={status ? (status.registered ? "sí" : "no") : "…"} />
        <Button title="Pedir permisos de ubicación" loading={busy === "permisos"} onPress={() => run("permisos", async () => void (await lab.requestPermissions()))} />
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Ajustes de la app" tone="secondary" onPress={() => void lab.openAppSettings()} /></View>
          <View style={styles.flex}><Button title="Batería: sin restricciones" tone="secondary" onPress={() => void lab.openBatteryOptimizationSettings()} /></View>
        </View>
        <Button title="Inicio automático (Xiaomi)" tone="secondary" onPress={() => void lab.openMiuiAutostart()} />
        <Text style={styles.hint}>
          Xiaomi/MIUI: además, Ajustes › Aplicaciones › Administrar aplicaciones › GeoCheck › Ahorro de batería › "Sin restricciones", y
          bloquea la app en Recientes (mantén pulsada la tarjeta › candado).
        </Text>
      </Section>

      <Section title="2. Geocerca de prueba">
        <Row label="Centro" value={config.center ? `${config.center.latitude.toFixed(5)}, ${config.center.longitude.toFixed(5)}${fixAccuracy != null ? ` (±${Math.round(fixAccuracy)} m)` : ""}` : "sin definir"} />
        <Button title="Usar mi ubicación como centro" tone="secondary" loading={busy === "ubicación"} disabled={config.geofenceActive} onPress={useMyLocation} />
        <View style={styles.chips}>
          {RADII.map((r) => (
            <Chip key={r} label={`${r} m`} selected={config.radius === r} onPress={() => !config.geofenceActive && update({ radius: r })} />
          ))}
        </View>
        {config.geofenceActive ? (
          <Button title="Quitar geocerca" tone="danger" loading={busy === "quitar"} onPress={() => run("quitar", lab.unregisterGeofence)} />
        ) : (
          <Button
            title="Registrar geocerca"
            disabled={!config.center || !bgOk}
            loading={busy === "registrar"}
            onPress={() => run("registrar", () => lab.registerGeofence(config.center!, config.radius))}
          />
        )}
        <Text style={styles.hint}>
          Para cambiar el centro o el radio hay que quitarla primero. Estado: {config.geofenceActive ? "ACTIVA" : "inactiva"}. Al registrar estando dentro,
          Android puede disparar un "entrada" inmediato: el análisis lo separa.
        </Text>
      </Section>

      <Section title="3. Escenario en curso">
        <View style={styles.chips}>
          {SCENARIOS.map((s) => (
            <Chip key={s.id} label={s.id} selected={config.scenario === s.id} onPress={() => update({ scenario: s.id })} />
          ))}
        </View>
        {scenario ? (
          <>
            <Text style={styles.scenarioTitle}>{scenario.id}. {scenario.title}</Text>
            <Text style={styles.hint}>{scenario.how}</Text>
          </>
        ) : null}
        <Text style={styles.label}>Perfil de batería del sistema</Text>
        <View style={styles.chips}>
          {BATTERY_PROFILES.map((p) => (
            <Chip key={p.id} label={p.title} selected={config.batteryProfile === p.id} onPress={() => update({ batteryProfile: p.id })} />
          ))}
        </View>
        <Text style={styles.hint}>Cada entrada del log queda etiquetada con el escenario y el perfil activos al momento.</Text>
      </Section>

      <Section title="4. Marcar cuando cruzas">
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Estoy ENTRANDO" disabled={locked} onPress={() => marker("enter")} /></View>
          <View style={styles.flex}><Button title="Estoy SALIENDO" disabled={locked} onPress={() => marker("exit")} /></View>
        </View>
        <Text style={styles.hint}>
          Toca en el momento exacto en que cruzas la frontera (con la app abierta o no: es solo la hora). La latencia es la hora del evento menos la de este toque.
          {lastMarker && lastMarker.kind === "marker" ? ` Último: ${lastMarker.type === "enter" ? "entrada" : "salida"} a las ${fmtLocal(lastMarker.t).slice(11)}.` : ""}
        </Text>
      </Section>

      <Section title="5. Batería">
        <TextInput style={styles.input} placeholder="Nota opcional (p. ej. inicio prueba sin geocerca)" value={note} onChangeText={setNote} />
        <Button
          title="Guardar lectura de batería"
          tone="secondary"
          onPress={() => void appendLog({ kind: "snapshot", note: note.trim() || undefined }).then(() => { setNote(""); return reload(); })}
        />
        <Text style={styles.hint}>
          Toma una al empezar y otra al terminar cada tramo, sin cargador. Para una geocerca activa y otra inactiva, compara también Ajustes › Batería › Uso por aplicación.
        </Text>
      </Section>

      <Section title="6. Resultados">
        {summary.verdict.map((v) => (
          <Text key={v.criterion} style={styles.verdict}>
            {v.pass == null ? "❔" : v.pass ? "✅" : "❌"} {v.criterion}{"\n"}
            <Text style={styles.muted}>{v.detail}</Text>
          </Text>
        ))}
        <Text style={[styles.label, styles.spaceTop]}>Últimas entradas ({entries.length} en total)</Text>
        {recent.length === 0 ? <Text style={styles.muted}>Sin entradas todavía.</Text> : null}
        {recent.map((e, i) => (
          <Text key={`${e.t}-${i}`} style={styles.logLine}>
            {fmtLocal(e.t).slice(5)} · esc.{e.scenario ?? "?"} · {e.kind}
            {"type" in e && e.type ? ` ${e.type}` : ""}
            {e.kind === "geofence" ? (e.cold ? " ❄ en frío" : " (app viva)") : ""}
            {typeof e.batteryLevel === "number" ? ` · 🔋${Math.round(e.batteryLevel * 100)}%` : ""}
          </Text>
        ))}
        <ErrorText message={error} />
        <Button title="Exportar log (compartir)" loading={busy === "exportar"} onPress={exportLog} />
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Actualizar" tone="secondary" onPress={() => void reload()} /></View>
          <View style={styles.flex}><Button title="Borrar log" tone="danger" onPress={confirmClear} /></View>
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  flex: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  muted: { fontSize: 12, color: colors.muted },
  section: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowLabel: { fontSize: 13, color: colors.muted, flex: 1 },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  warn: { color: colors.danger },
  buttonRow: { flexDirection: "row", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white" },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: "white", fontWeight: "700" },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  spaceTop: { marginTop: 6 },
  scenarioTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: "white" },
  verdict: { fontSize: 13, color: colors.text, lineHeight: 18 },
  logLine: { fontSize: 11, color: colors.text, fontFamily: Platform.OS === "android" ? "monospace" : "Menlo" },
  alert: { backgroundColor: colors.warningBg, borderRadius: 8, padding: 12 },
  alertText: { color: colors.warningText, fontSize: 13 },
});
