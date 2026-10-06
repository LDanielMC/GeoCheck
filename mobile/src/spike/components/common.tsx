import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../ui";

export function Chip({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipSelected, disabled && !selected && styles.chipDisabled]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: "bad" | "warn" | "good" }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone === "bad" && styles.bad, tone === "warn" && styles.warn, tone === "good" && styles.good]}>{value}</Text>
    </View>
  );
}

export function Notice({ tone, children }: { tone: "bad" | "warn" | "info"; children: React.ReactNode }) {
  return (
    <View style={[styles.notice, tone === "bad" && styles.noticeBad, tone === "warn" && styles.noticeWarn]}>
      <Text style={[styles.noticeText, tone === "bad" && styles.bad, tone === "warn" && styles.noticeWarnText]}>{children}</Text>
    </View>
  );
}

export const spikeColors = { inside: colors.primary, outside: colors.danger, uncertain: colors.warningText };

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white" },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: "white", fontWeight: "700" },
  section: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowLabel: { fontSize: 13, color: colors.muted, flex: 1 },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  bad: { color: colors.danger },
  warn: { color: colors.warningText },
  good: { color: colors.primary },
  notice: { borderRadius: 8, padding: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.border },
  noticeBad: { borderColor: colors.danger, backgroundColor: "#FCEBEB" },
  noticeWarn: { borderColor: colors.warningBg, backgroundColor: colors.warningBg },
  noticeText: { fontSize: 12, color: colors.text, lineHeight: 17 },
  noticeWarnText: { color: colors.warningText },
});
