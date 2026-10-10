import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { AppText } from "./AppText";
import { fontFamily } from "./fonts";
import { colors, MAX_FONT_SCALE, radius, spacing, TOUCH_MIN } from "./tokens";

// Campo de texto con su etiqueta arriba. El borde es el fuerte (`edge`) para que se vea al sol; al enfocar pasa a verde.
export function Field({ label, error, hint, style, onFocus, onBlur, ...inputProps }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const [focused, setFocused] = useState(false);
  const readOnly = inputProps.editable === false;
  return (
    <View style={styles.field}>
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[
          styles.input,
          { fontFamily: fontFamily("text") },
          focused && styles.focused,
          error ? styles.invalid : null,
          readOnly && styles.readOnly,
          style,
        ]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...inputProps}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.muted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

// Contenedor de formularios: sube con el teclado y permite tocar fuera sin cerrarlo.
export function FormScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <AppText variant="title" style={styles.center}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color={colors.muted} style={[styles.center, styles.subtitle]}>
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { flexGrow: 1, padding: spacing.lg, justifyContent: "center", gap: spacing.md },
  center: { textAlign: "center" },
  subtitle: { marginBottom: spacing.md },
  field: { gap: spacing.xs },
  input: {
    minHeight: TOUCH_MIN,
    borderWidth: 1.5,
    borderColor: colors.edge,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  readOnly: { backgroundColor: colors.paper, color: colors.muted },
});
