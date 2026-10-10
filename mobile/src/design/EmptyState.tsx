import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { colors, radius, spacing } from "./tokens";

// Pantalla vacía con instrucciones: qué falta y qué hacer, con la acción a un toque.
export function EmptyState({ icon, title, message, actionLabel, onAction }: { icon: IconName; title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.box}>
      <View style={styles.glyph}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color={colors.muted} style={styles.center}>
        {message}
      </AppText>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: spacing.md, padding: spacing.xl },
  glyph: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  action: { alignSelf: "stretch", marginTop: spacing.sm },
});
