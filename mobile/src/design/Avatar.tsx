import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { initials } from "./initials";
import { colors } from "./tokens";

// Círculo con las iniciales de la persona.
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText variant="subheading" color={colors.onPrimary} style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.5) }}>
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
