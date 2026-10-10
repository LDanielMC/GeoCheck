import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { colors, spacing, TOUCH_MIN } from "./tokens";
import { texts } from "../texts";

// Fondo de pantalla: papel, con el margen estándar. `scroll` para contenido que puede crecer.
export function Screen({ children, scroll = false }: { children: React.ReactNode; scroll?: boolean }) {
  if (scroll) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, styles.content]}>{children}</View>;
}

// Título de pantalla; con `onBack` lleva la flecha de volver (pantallas que se abren encima de una pestaña).
export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={texts.common.back} style={styles.back} hitSlop={8}>
          <Icon name="back" size={26} color={colors.text} />
        </Pressable>
      ) : null}
      <AppText variant="title" accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: TOUCH_MIN },
  back: { width: TOUCH_MIN, height: TOUCH_MIN, marginLeft: -spacing.md, alignItems: "center", justifyContent: "center" },
  title: { flex: 1 },
});
