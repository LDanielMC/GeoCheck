import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "./tokens";

// Opción seleccionable en fila (filtros, radio, rol, vigencia).
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText variant="smallStrong" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export type BadgeTone = "success" | "warning" | "danger" | "neutral";

const BADGE: Record<BadgeTone, { background: string; text: string }> = {
  success: { background: colors.primaryTint, text: colors.primary },
  warning: { background: colors.accentTint, text: colors.accentText },
  danger: { background: colors.dangerTint, text: colors.danger },
  neutral: { background: colors.paper, text: colors.muted },
};

// Etiqueta de estado. El estado nunca va solo en color: siempre lleva texto.
export function Badge({ label, tone = "success" }: { label: string; tone?: BadgeTone }) {
  const look = BADGE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: look.background }]}>
      <AppText variant="captionStrong" color={look.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.edge, backgroundColor: colors.card, justifyContent: "center" },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  badge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
});
