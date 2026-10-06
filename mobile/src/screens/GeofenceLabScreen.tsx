// Laboratorio del spike de geofencing: solo en el dispositivo, sin backend ni login.
// Se muestra cuando EXPO_PUBLIC_SPIKE=1 (ver App.tsx y el perfil "spike" de eas.json).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AppState, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as Sharing from "expo-sharing";
import {
  fmtClock,
  fmtLocal,
  lastActiveMarker,
  sessionAt,
  summarize,
  summaryText,
  type GeofenceEntry,
  type SpikeEntry,
  type VerdictStatus,
} from "../spike/analysis";
import CaptureCrossing from "../spike/components/CaptureCrossing";
import { Chip, Notice, Row, Section } from "../spike/components/common";
import LivePanel from "../spike/components/LivePanel";
import ScenarioCard from "../spike/components/ScenarioCard";
import { MARGIN_M } from "../spike/geo";
import * as lab from "../spike/geofenceLab";
import { markerNotificationPresent, postMarkerNotification, requestNotificationPermission, setMarkerNotification } from "../spike/labNotifications";
import { BATTERY_PROFILES, SCENARIOS } from "../spike/scenarios";
import { appendLog, clearLog, newMarkerId, readConfig, readLog, writeConfig, writeExportFile, type SpikeConfig } from "../spike/spikeStorage";
import { Button, colors, ErrorText } from "../ui";

const RADII = [100, 150, 200];
const MARKER_LOCK_MS = 10_000; // evita contar dos veces un doble toque
const VERDICT_ICON: Record<VerdictStatus, string> = { ok: "✅", fail: "❌", insufficient: "⏳", nodata: "❔" };
const typeLabel = (type: "enter" | "exit") => (type === "enter" ? "ENTRADA" : "SALIDA");
const isGeofence = (e: SpikeEntry): e is GeofenceEntry => e.kind === "geofence";

export default function GeofenceLabScreen() {
  const [config, setConfig] = useState<SpikeConfig>(() => readConfig());
  const [status, setStatus] = useState<lab.LabStatus | null>(null);
  const [entries, setEntries] = useState<SpikeEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingWarning, setMissingWarning] = useState(false);
  const [markerNotifMissing, setMarkerNotifMissing] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [clockTick, forceTick] = useState(0);
  const [note, setNote] = useState("");
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const current = readConfig();
    setConfig(current);
    setEntries(readLog());
    const next = await lab.getStatus().catch(() => null);
    if (next) setStatus(next);
    setMarkerNotifMissing(current.markerNotification ? !(await markerNotificationPresent()) : false);
  }, []);

  // Al abrir (y al volver a primer plano): deja constancia del estado, detecta si el sistema borró la geocerca
  // y si la notificación fija de marcadores desapareció.
  useEffect(() => {
    let cancelled = false;
    const onOpen = async () => {
      try {
        const { missing } = await lab.checkRegistration();
        if (cancelled) return;
        setMissingWarning(missing);
        await reload();
        if (readConfig().markerNotification && !(await markerNotificationPresent())) {
          await appendLog({ kind: "marker_notification", enabled: true, present: false });
        }
      } catch (e) {
        await appendLog({ kind: "error", where: "on_open", message: e instanceof Error ? e.message : String(e) });
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

  // Los eventos y marcadores los escriben tareas en segundo plano: se relee el log para que la pantalla no
  // quede vieja (y el análisis recalcula pendientes cada 30 s).
  useEffect(() => {
    const poll = setInterval(() => {
      const log = readLog();
      setEntries((prev) => (prev.length === log.length && prev.at(-1)?.t === log.at(-1)?.t ? prev : log));
      const next = readConfig();
      setConfig((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, 3000);
    const minute = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(minute);
    };
  }, []);

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

  const sessionActive = config.session !== null;
  const summary = useMemo(() => summarize(entries, Date.now()), [entries, clockTick]);
  const check = status ? lab.runPreflight(config, status) : null;
  const blocked = !check || check.blockers.length > 0;
  const onlyOverridable = !!check && check.blockers.length > 0 && check.blockers.every((b) => b.overridable);
  const bgOk = status?.background === "granted";
  const sessionMarkers = summary.markerResults.filter((r) => r.session === config.session);
  const pending = sessionMarkers.filter((r) => r.status === "pending").at(-1);
  const lastEvent = entries.filter(isGeofence).at(-1);
  const locked = Date.now() < lockedUntil;
  const profileTitle = BATTERY_PROFILES.find((p) => p.id === config.batteryProfile)?.title ?? config.batteryProfile;
  const scenario = SCENARIOS.find((s) => s.id === config.scenario);

  const useMyLocation = () =>
    run("ubicación", async () => {
      const { accuracy, ...center } = await lab.currentPosition();
      setFixAccuracy(accuracy);
      update({ center });
    });

  const startSession = (override: boolean) =>
    run("iniciar sesión", async () => {
      await lab.startSession(config.center!, config.radius, { overrideBatteryCheck: override });
    });

  const confirmOverride = () =>
    Alert.alert(
      "Iniciar de todos modos",
      "La comprobación de batería falló. Si ya pusiste «Sin restricciones» en MIUI (que Android no ve) puedes continuar: la sesión queda marcada como «verificación forzada» en el log. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Iniciar", onPress: () => void startSession(true) },
      ]
    );

  const marker = (type: "enter" | "exit") => {
    void appendLog({ kind: "marker", type, id: newMarkerId(), via: "app" }).then(async () => {
      await reload();
      if (readConfig().markerNotification) await postMarkerNotification().catch(() => undefined);
    });
    setLockedUntil(Date.now() + MARKER_LOCK_MS);
    setTimeout(() => forceTick((n) => n + 1), MARKER_LOCK_MS + 50);
  };

  // Un cruce capturado después pertenece a la sesión que estaba abierta a la hora real del cruce, no a la actual.
  const saveCaptured = async (type: "enter" | "exit", when: Date) => {
    const info = sessionAt(readLog(), when.getTime());
    if (!info) throw new Error("A esa hora no había ninguna sesión activa. Revisa la hora e inténtalo de nuevo.");
    await appendLog({
      kind: "marker",
      type,
      id: newMarkerId(),
      via: "manual_time",
      t: when.toISOString(),
      capturedAt: new Date().toISOString(),
      session: info.id,
      scenario: info.scenario,
      batteryProfile: info.batteryProfile,
      geofenceActive: true,
      // La batería de ahora no es la de la hora del cruce: no debe entrar en el cálculo de consumo.
      batteryLevel: null,
      charging: null,
    });
    await reload();
  };

  const undoLast = () => {
    const last = lastActiveMarker(readLog());
    if (!last) return Alert.alert("Nada que deshacer", "No hay marcadores vigentes.");
    Alert.alert("Deshacer el último marcador", `${typeLabel(last.type)} de las ${fmtClock(last.t)}. ¿Anularlo?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deshacer",
        style: "destructive",
        onPress: () => void appendLog({ kind: "marker_undo", markerId: last.id, markerT: last.t }).then(reload),
      },
    ]);
  };

  const toggleMarkerNotification = (enabled: boolean) =>
    run("notificación", async () => {
      if (enabled && status?.notifications !== "granted") {
        if ((await requestNotificationPermission()) !== "granted") throw new Error("Concede el permiso de notificaciones para usar los botones «Entré» / «Salí».");
      }
      await setMarkerNotification(enabled);
    });

  const exportLog = () =>
    run("exportar", async () => {
      const all = readLog();
      const device = { platform: Platform.OS, constants: Platform.constants, exportedAt: new Date().toISOString(), config: readConfig() };
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

  const recent = [...entries].reverse().slice(0, 12);
  const sessionsRecent = [...summary.sessions].reverse().slice(0, 5);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Laboratorio de geofencing</Text>
      <Text style={styles.muted}>Spike: todo se guarda solo en este teléfono. No requiere sesión ni servidor.</Text>

      {missingWarning ? (
        <Notice tone="warn">
          Expo ya no tiene registrada la geocerca (se perdió su registro). La sesión se cerró y quedó en el log. Inicia una nueva abajo. Ojo: el laboratorio no ve si Google Play Services la perdió; eso se nota en un marcador sin evento.
        </Notice>
      ) : null}
      {markerNotifMissing ? (
        <Notice tone="warn">
          La notificación fija de marcadores ya no está en la bandeja (un reinicio o que el sistema cierre la app la quita). Hasta que la vuelvas a mostrar, captura los cruces con «Agregar cruce con hora».
        </Notice>
      ) : null}

      <LivePanel
        center={config.center}
        radius={config.radius}
        enabled={config.livePanel}
        onToggle={(livePanel) => update({ livePanel })}
        canUseLocation={status?.foreground === "granted"}
        lastEvent={lastEvent ? { type: lastEvent.type, at: lastEvent.t, initial: lastEvent.initial === true } : null}
        pendingMarker={pending ? { type: pending.type, at: pending.markerAt } : null}
      />

      <Section title="1. Permisos y sistema">
        <Row
          label="Ubicación en primer plano"
          value={`${status?.foreground ?? "…"} (${status?.foregroundAccuracy ?? "…"})`}
          tone={status && (status.foreground !== "granted" || status.foregroundAccuracy === "coarse") ? "bad" : undefined}
        />
        <Row label="Permitir todo el tiempo" value={status?.background ?? "…"} tone={status && !bgOk ? "bad" : undefined} />
        <Row label="Servicios de ubicación" value={status ? (status.servicesEnabled ? "activos" : "APAGADOS") : "…"} tone={status?.servicesEnabled === false ? "bad" : undefined} />
        <Row label="Notificaciones" value={status?.notifications ?? "…"} tone={status && status.notifications !== "granted" ? "warn" : undefined} />
        <Row
          label="Optimización de batería (Android)"
          value={status?.batteryOptimization == null ? "desconocido" : status.batteryOptimization ? "ACTIVA: puede restringir la app" : "sin restricciones"}
          tone={status?.batteryOptimization === true ? "bad" : status?.batteryOptimization === false ? "good" : undefined}
        />
        <Row label="Ahorro de batería del sistema" value={status?.lowPowerMode == null ? "desconocido" : status.lowPowerMode ? "ACTIVO" : "apagado"} tone={status?.lowPowerMode ? "warn" : undefined} />
        <Row label="Geocerca registrada en el sistema" value={status ? (status.registered ? "sí" : "no") : "…"} />
        <Row
          label="Proveedores de ubicación"
          value={status?.providers ? `GPS ${status.providers.gps ? "sí" : "no"} · red ${status.providers.network ? "sí" : "no"}` : "…"}
          tone={status?.providers && status.providers.network === false ? "warn" : undefined}
        />
        {status?.batteryOptimization === true ? (
          <Notice tone="bad">
            Android reporta que PUEDE restringir la batería de esta app. Es lo esperado con el perfil «Ajustes por defecto». Para el perfil «Sin restricciones» toca «Pedir exclusión»; el
            «Sin restricciones» de MIUI es otro interruptor y esta lectura no lo ve.
          </Notice>
        ) : null}
        <Button title="Pedir permisos (ubicación y notificaciones)" loading={busy === "permisos"} onPress={() => run("permisos", async () => void (await lab.requestPermissions()))} />
        <Button title="Pedir exclusión de batería (diálogo del sistema)" tone="secondary" onPress={() => void lab.requestBatteryExemption()} />
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Lista de optimización" tone="secondary" onPress={() => void lab.openBatteryOptimizationList()} /></View>
          <View style={styles.flex}><Button title="Ahorro MIUI (esta app)" tone="secondary" onPress={() => void lab.openMiuiBatterySaver()} /></View>
        </View>
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Inicio automático" tone="secondary" onPress={() => void lab.openMiuiAutostart()} /></View>
          <View style={styles.flex}><Button title="Ajustes de notificaciones" tone="secondary" onPress={() => void lab.openNotificationSettings()} /></View>
        </View>
        <Button title="Ajustes de la app" tone="secondary" onPress={() => void lab.openAppSettings()} />
        <Text style={styles.hint}>
          Los atajos de Xiaomi son intentos que no se pudieron verificar: si no abren la pantalla correcta, caen a los ajustes de la app. Además bloquea la app en Recientes (mantén pulsada la
          tarjeta › candado). En «Notificaciones» activa las notificaciones flotantes y la vibración para los avisos de detección.
        </Text>
      </Section>

      <Section title="2. Geocerca de prueba y sesión">
        {sessionActive ? (
          <Notice tone="info">
            Sesión {config.session} en curso desde las {config.sessionStartedAt ? fmtClock(new Date(config.sessionStartedAt).toISOString()) : "—"} · escenario {config.scenario} · perfil «{profileTitle}» ·
            radio {config.radius} m. Para cambiar el escenario, el perfil, el centro o el radio hay que terminar la sesión: así no se mezclan datos.
          </Notice>
        ) : null}
        <Row
          label="Centro"
          value={config.center ? `${config.center.latitude.toFixed(5)}, ${config.center.longitude.toFixed(5)}${fixAccuracy != null ? ` (±${Math.round(fixAccuracy)} m)` : ""}` : "sin definir"}
        />
        <Button title="Usar mi ubicación como centro" tone="secondary" loading={busy === "ubicación"} disabled={sessionActive} onPress={useMyLocation} />
        <View style={styles.chips}>
          {RADII.map((r) => (
            <Chip key={r} label={`${r} m`} selected={config.radius === r} disabled={sessionActive} onPress={() => update({ radius: r })} />
          ))}
        </View>
        {sessionActive ? (
          <Button title="Terminar sesión (quitar geocerca)" tone="danger" loading={busy === "terminar"} onPress={() => run("terminar", () => lab.endSession("manual"))} />
        ) : (
          <>
            {check?.blockers.map((b) => (
              <Notice key={b.message} tone="bad">{b.message}</Notice>
            ))}
            {check?.warnings.map((w) => (
              <Notice key={w.message} tone="warn">{w.message}</Notice>
            ))}
            <Button title="Iniciar sesión (registrar geocerca)" disabled={!config.center || blocked} loading={busy === "iniciar sesión"} onPress={() => void startSession(false)} />
            {config.center && onlyOverridable ? <Button title="Iniciar de todos modos (queda marcado en el log)" tone="secondary" onPress={confirmOverride} /> : null}
          </>
        )}
        <ErrorText message={error} />
        <Text style={styles.hint}>
          Cada sesión es una geocerca registrada con escenario, perfil, centro y radio fijos; los datos de una sesión nunca se mezclan con los de otra. Al registrar estando dentro Android avisa
          «entrada» al instante (estado inicial): el análisis lo separa y no lo cuenta como cruce.
        </Text>
      </Section>

      <Section title="3. Escenario">
        <View style={styles.chips}>
          {SCENARIOS.map((s) => (
            <Chip key={s.id} label={s.id} selected={config.scenario === s.id} disabled={sessionActive} onPress={() => update({ scenario: s.id })} />
          ))}
        </View>
        <Text style={styles.label}>Perfil de batería del sistema</Text>
        <View style={styles.chips}>
          {BATTERY_PROFILES.map((p) => (
            <Chip key={p.id} label={p.title} selected={config.batteryProfile === p.id} disabled={sessionActive} onPress={() => update({ batteryProfile: p.id })} />
          ))}
        </View>
        {scenario ? <ScenarioCard scenario={scenario} radius={config.radius} margin={MARGIN_M} /> : null}
      </Section>

      <Section title="4. Marcar cuando cruzas">
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Estoy ENTRANDO" disabled={locked || !sessionActive} onPress={() => marker("enter")} /></View>
          <View style={styles.flex}><Button title="Estoy SALIENDO" disabled={locked || !sessionActive} onPress={() => marker("exit")} /></View>
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>Marcar sin abrir la app</Text>
            <Text style={styles.hint}>Notificación fija con los botones «Entré» y «Salí». Funciona con la app en segundo plano o cerrada, pero se pierde al reiniciar.</Text>
          </View>
          <Switch value={config.markerNotification} onValueChange={(v) => void toggleMarkerNotification(v)} disabled={busy === "notificación"} trackColor={{ true: colors.primary }} />
        </View>
        <CaptureCrossing disabled={entries.every((e) => e.kind !== "session_start" && e.kind !== "register")} onSave={saveCaptured} />
        <Button title="Deshacer el último marcador" tone="secondary" onPress={undoLast} />
        {sessionMarkers.length > 0 ? (
          <View style={styles.list}>
            <Text style={styles.label}>Marcadores de esta sesión</Text>
            {sessionMarkers.map((r) => (
              <Text key={`${r.markerAt}-${r.type}`} style={styles.logLine}>
                {fmtClock(r.markerAt)} {typeLabel(r.type)}
                {r.via === "notification" ? " (notif.)" : r.via === "manual_time" ? " (capturado)" : ""} →{" "}
                {r.status === "detected" ? `detectada +${Math.round(r.latencyS ?? 0)} s` : r.status === "pending" ? "esperando evento…" : r.status === "missed" ? "NO detectada" : "cancelado"}
              </Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.hint}>
          La latencia es la hora del evento menos la del cruce. Tocar en el momento exacto de pisar el borde es lo ideal; si no puedes, captura la hora después. Dos toques seguidos del mismo botón se
          cuentan como uno.
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
          Toma una al empezar y otra al terminar cada tramo, sin cargador y con las mismas condiciones. El dato fiable es Ajustes › Batería › Uso por aplicación; el cálculo de la app es una
          estimación gruesa (mezcla pantalla y uso).
        </Text>
      </Section>

      <Section title="6. Resultados">
        {summary.verdict.map((v) => (
          <Text key={v.criterion} style={styles.verdict}>
            {VERDICT_ICON[v.status]} {v.criterion}{"\n"}
            <Text style={styles.muted}>{v.detail}</Text>
          </Text>
        ))}
        <Text style={[styles.label, styles.spaceTop]}>Sesiones</Text>
        {sessionsRecent.length === 0 ? <Text style={styles.muted}>Sin sesiones todavía.</Text> : null}
        {sessionsRecent.map((s) => (
          <Text key={s.id} style={styles.logLine}>
            {s.id} · esc.{s.scenario} · {s.endedAt ? "cerrada" : "EN CURSO"} · marcadores {s.detected}/{s.markers} · eventos {s.events} ({s.unmatchedEvents} sin marcador)
          </Text>
        ))}
        <Text style={[styles.label, styles.spaceTop]}>Últimas entradas ({entries.length} en total)</Text>
        {recent.length === 0 ? <Text style={styles.muted}>Sin entradas todavía.</Text> : null}
        {recent.map((e, i) => (
          <Text key={`${e.t}-${i}`} style={styles.logLine}>
            {fmtLocal(e.t).slice(5)} · {e.session ?? "—"} · {e.kind}
            {"type" in e && e.type ? ` ${e.type}` : ""}
            {e.kind === "geofence" ? (e.initial ? " (inicial)" : e.cold ? " ❄ en frío" : " (app viva)") : ""}
            {typeof e.batteryLevel === "number" ? ` · 🔋${Math.round(e.batteryLevel * 100)}%` : ""}
          </Text>
        ))}
        <Button title="Exportar log (compartir)" loading={busy === "exportar"} onPress={exportLog} />
        <View style={styles.buttonRow}>
          <View style={styles.flex}><Button title="Actualizar" tone="secondary" onPress={() => void reload()} /></View>
          <View style={styles.flex}><Button title="Borrar log" tone="danger" disabled={sessionActive} onPress={confirmClear} /></View>
        </View>
        {sessionActive ? <Text style={styles.hint}>Para borrar el log termina antes la sesión en curso.</Text> : null}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  flex: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  muted: { fontSize: 12, color: colors.muted },
  buttonRow: { flexDirection: "row", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  spaceTop: { marginTop: 6 },
  list: { gap: 2 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: "white" },
  verdict: { fontSize: 13, color: colors.text, lineHeight: 18 },
  logLine: { fontSize: 11, color: colors.text, fontFamily: Platform.OS === "android" ? "monospace" : "Menlo" },
});
