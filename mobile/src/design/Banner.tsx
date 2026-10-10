import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { colors, radius, spacing, TOUCH_MIN } from "./tokens";
import { texts } from "../texts";

export type BannerTone = "warning" | "error" | "info";

const LOOK: Record<BannerTone, { background: string; border: string; text: string }> = {
  warning: { background: colors.accentTint, border: colors.accent, text: colors.accentText },
  error: { background: colors.dangerTint, border: colors.danger, text: colors.danger },
  info: { background: colors.primaryTint, border: colors.primary, text: colors.primary },
};

// Aviso con franja lateral: sin conexión, obra que se encima, error al guardar. Lleva ícono y texto, no solo color.
// `actionLabel` + `onAction` añade una acción (Reintentar); `onClose`, una X.
export function Banner({
  tone = "warning",
  title,
  message,
  actionLabel,
  onAction,
  onClose,
}: {
  tone?: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const look = LOOK[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: look.background, borderLeftColor: look.border }]}>
      <Icon name="alert" size={24} color={look.text} />
      <View style={styles.body}>
        {title ? (
          <AppText variant="bodyStrong" color={colors.text}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="small" color={tone === "warning" ? colors.accentText : colors.text}>
          {message}
        </AppText>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} style={styles.action}>
            <AppText variant="smallStrong" color={look.text}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={texts.common.close} hitSlop={12}>
          <Icon name="close" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Mensaje de error de un formulario (texto corto, sin tarjeta).
export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <AppText variant="small" color={colors.danger} style={styles.error}>
      {message}
    </AppText>
  ) : null;
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderRadius: radius.md, borderLeftWidth: 5, padding: spacing.md },
  body: { flex: 1, gap: 2 },
  action: { minHeight: TOUCH_MIN - 8, justifyContent: "center", alignSelf: "flex-start" },
  error: { textAlign: "center" },
});
