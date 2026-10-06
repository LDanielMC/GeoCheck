// Explicación corta del flujo del escenario elegido: dónde empezar, hasta dónde caminar y qué hacer al cruzar.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { renderScenario, type Scenario } from "../scenarios";
import { colors } from "../../ui";

export default function ScenarioCard({ scenario, radius, margin }: { scenario: Scenario; radius: number; margin: number }) {
  const r = renderScenario(scenario, radius, margin);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {r.id}. {r.title}
      </Text>
      <Text style={styles.line}>
        <Text style={styles.label}>Empieza: </Text>
        {r.start}
      </Text>
      <Text style={styles.line}>
        <Text style={styles.label}>Teléfono: </Text>
        {r.phone}
      </Text>
      <Text style={styles.recon}>{r.recon}</Text>
      {r.steps.map((step, i) => (
        <View key={step} style={styles.step}>
          <Text style={styles.stepNumber}>{i + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
      <Text style={styles.line}>
        <Text style={styles.label}>Marcar: </Text>
        {r.mark}
      </Text>
      <Text style={styles.line}>
        <Text style={styles.label}>Repetir: </Text>
        {r.repeat}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 8, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  line: { fontSize: 12, color: colors.text, lineHeight: 17 },
  label: { fontWeight: "700" },
  recon: { fontSize: 12, color: colors.muted, lineHeight: 17, fontStyle: "italic" },
  step: { flexDirection: "row", gap: 8 },
  stepNumber: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, color: "white", textAlign: "center", fontSize: 11, fontWeight: "700", lineHeight: 18, overflow: "hidden" },
  stepText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
});
