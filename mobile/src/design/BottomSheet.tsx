import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { colors, radius, shadows, spacing } from "./tokens";
import { texts } from "../texts";

// Hoja inferior para confirmar o elegir sin salir de la pantalla. Se cierra tocando fuera o con «atrás» de Android.
// Lleva su propio SafeAreaProvider porque un Modal es otra raíz de vistas.
export function BottomSheet({ visible, title, onClose, children }: { visible: boolean; title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        <View style={styles.root}>
          <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={texts.common.close} />
          <Sheet title={title}>{children}</Sheet>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

function Sheet({ title, children }: { title?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, shadows.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
      <View style={styles.handle} />
      {title ? (
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: spacing.xs },
});
