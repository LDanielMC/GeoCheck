import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, colors, Icon, spacing, type IconName } from "../design";
import { texts } from "../texts";
import type { TabId } from "./tabs";

const TAB_ICONS: Record<TabId, IconName> = { home: "home", projects: "projects", records: "records", team: "team", more: "more" };

// Barra de pestañas inferior. La activa lleva el ícono sobre un óvalo verde claro y el texto en verde; el estado no va
// solo en color (el óvalo y el rótulo cambian). Las etiquetas no crecen más de 1.1 con la letra grande: con cinco pestañas
// «Registros» no cabría.
export function TabBar({ tabs, active, onSelect }: { tabs: readonly TabId[]; active: TabId; onSelect: (tab: TabId) => void }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <Pressable key={tab} style={styles.tab} onPress={() => onSelect(tab)} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={texts.tabs[tab]}>
            <View style={[styles.pill, selected && styles.pillActive]}>
              <Icon name={TAB_ICONS[tab]} size={22} color={selected ? colors.primary : colors.muted} />
            </View>
            <AppText variant="captionStrong" color={selected ? colors.primary : colors.muted} maxFontSizeMultiplier={1.1} numberOfLines={1}>
              {texts.tabs[tab]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  tab: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pillActive: { backgroundColor: colors.primaryTint },
});
