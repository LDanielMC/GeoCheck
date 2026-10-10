import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Card, colors, Screen, ScreenHeader, spacing } from "../design";

// Pantalla de solo lectura con pares etiqueta / valor (Mi perfil, Datos de la empresa).
export default function InfoScreen({ title, rows, onBack }: { title: string; rows: { label: string; value: string }[]; onBack: () => void }) {
  return (
    <Screen scroll>
      <ScreenHeader title={title} onBack={onBack} />
      <Card>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.separator]}>
            <AppText variant="caption" color={colors.muted}>
              {row.label}
            </AppText>
            <AppText variant="bodyStrong">{row.value}</AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2, paddingVertical: spacing.md },
  separator: { borderTopWidth: 1, borderTopColor: colors.line },
});
