import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { colors, radius, spacing, TOUCH_MIN } from "./tokens";

// Grupo de filas con una etiqueta en mayúsculas (USUARIO, EMPRESA, CUENTA): la pestaña «Más».
export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      {title ? (
        <AppText variant="label" color={colors.muted} style={styles.title}>
          {title}
        </AppText>
      ) : null}
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

// Fila tocable con ícono, texto y flecha. `danger` es para acciones como cerrar sesión.
export function ListRow({ icon, label, value, onPress, tone = "default", last = false }: { icon: IconName; label: string; value?: string; onPress?: () => void; tone?: "default" | "danger"; last?: boolean }) {
  const color = tone === "danger" ? colors.danger : colors.text;
  const content = (
    <>
      <Icon name={icon} size={22} color={tone === "danger" ? colors.danger : colors.muted} />
      <AppText variant="bodyStrong" color={color} style={styles.label} numberOfLines={1}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="small" color={colors.muted} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {onPress && tone !== "danger" ? <Icon name="next" size={18} color={colors.muted} /> : null}
    </>
  );
  const rowStyle = [styles.row, !last && styles.separator];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  title: { paddingHorizontal: spacing.lg },
  rows: { backgroundColor: colors.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: "hidden" },
  row: { minHeight: TOUCH_MIN + 4, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.card },
  separator: { borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { flex: 1 },
  value: { maxWidth: "45%" },
  pressed: { backgroundColor: colors.paper },
});
