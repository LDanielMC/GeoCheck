import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { colors, radius, shadows, spacing, TOUCH_MIN } from "./tokens";

export type ButtonTone = "primary" | "secondary" | "danger" | "accent" | "ghost";

const TONES: Record<ButtonTone, { background: string; pressed: string; content: string; border?: string }> = {
  primary: { background: colors.primary, pressed: colors.primaryDark, content: colors.onPrimary },
  secondary: { background: colors.card, pressed: colors.primaryTint, content: colors.primary, border: colors.primary },
  danger: { background: colors.danger, pressed: colors.dangerDark, content: colors.onPrimary },
  accent: { background: colors.accent, pressed: colors.accentDark, content: colors.text },
  ghost: { background: "transparent", pressed: colors.primaryTint, content: colors.primary },
};

// Botón principal de la app. `large` es el botón redondeado y grande de las acciones que más importan.
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  tone = "primary",
  size = "normal",
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: ButtonTone;
  size?: "normal" | "large";
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const look = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === "large" && styles.large,
        { backgroundColor: pressed ? look.pressed : look.background },
        look.border ? { borderWidth: 1.5, borderColor: look.border } : null,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.content} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={size === "large" ? 24 : 20} color={look.content} /> : null}
          <AppText variant="button" color={look.content} style={size === "large" ? styles.largeText : undefined} numberOfLines={1}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.link} accessibilityRole="button" accessibilityLabel={title}>
      <AppText variant="bodyStrong" color={colors.primary}>
        {title}
      </AppText>
    </Pressable>
  );
}

// Botón redondo con un ícono (sobre el mapa: «Mi ubicación», capas; o «atrás»).
export function IconButton({ icon, label, onPress, tone = "light" }: { icon: IconName; label: string; onPress: () => void; tone?: "light" | "primary" }) {
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, shadows.float, { backgroundColor: primary ? colors.primary : colors.card }, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={primary ? colors.onPrimary : colors.primary} />
    </Pressable>
  );
}

// Botón flotante de la acción principal de una pantalla (Obras: «+»).
export function Fab({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, shadows.float, { backgroundColor: pressed ? colors.primaryDark : colors.primary }]}
    >
      <Icon name={icon} size={26} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: TOUCH_MIN, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  large: { minHeight: 56, borderRadius: 28, paddingHorizontal: spacing.xl },
  largeText: { fontSize: 17 },
  inactive: { opacity: 0.55 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  link: { minHeight: TOUCH_MIN, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  round: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85 },
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
