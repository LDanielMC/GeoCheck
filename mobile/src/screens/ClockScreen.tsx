// Pantalla principal del empleado — corresponde al wireframe "Employee · Hoy".
// US-01, US-02, US-03, US-04.

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../services/api";

export default function ClockScreen() {
  const [status, setStatus] = useState<"inside" | "outside">("outside");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleManualClockOut = async () => {
    // RF-05: clock-out manual como alternativa al automático
    try {
      await api.post("/time-entries/manual-clock-out");
      setStatus("outside");
      setElapsed(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusCard, status === "inside" ? styles.inside : styles.outside]}>
        <Text style={styles.statusLabel}>
          {status === "inside" ? "Dentro del sitio" : "Fuera de sitio"}
        </Text>
        <Text style={styles.projectName}>Casa Reforma 245</Text>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>Tiempo activo</Text>
        <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>
      </View>

      <TouchableOpacity style={styles.manualButton} onPress={handleManualClockOut}>
        <Text style={styles.manualButtonText}>Registrar salida manual</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>La salida se registra sola al salir del radio</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center", gap: 12 },
  statusCard: { borderRadius: 12, padding: 16, alignItems: "center" },
  inside: { backgroundColor: "#EAF3DE" },
  outside: { backgroundColor: "#FCEBEB" },
  statusLabel: { fontSize: 12, color: "#3B6D11" },
  projectName: { fontSize: 22, fontWeight: "500", marginTop: 4 },
  timerCard: { backgroundColor: "#F1EFE8", borderRadius: 8, padding: 12, alignItems: "center" },
  timerLabel: { fontSize: 12, color: "#5F5E5A" },
  timerValue: { fontSize: 28, fontWeight: "500", marginTop: 2 },
  manualButton: { backgroundColor: "#E24B4A", borderRadius: 8, padding: 12, alignItems: "center" },
  manualButtonText: { color: "white", fontSize: 14, fontWeight: "500" },
  hint: { fontSize: 11, color: "#888780", textAlign: "center" },
});
