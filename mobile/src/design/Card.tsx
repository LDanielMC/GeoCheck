import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "./tokens";

// Tarjeta blanca sobre el papel. Con `onPress` es tocable (fila de una lista).
export function Card({ children, onPress, accessibilityLabel, style }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  pressed: { backgroundColor: colors.paper },
});
