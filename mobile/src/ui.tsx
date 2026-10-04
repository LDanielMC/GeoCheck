import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";

export const colors = {
  primary: "#3B6D11",
  danger: "#E24B4A",
  text: "#1F1F1E",
  muted: "#5F5E5A",
  border: "#DDDDDD",
  surface: "#F1EFE8",
  warningBg: "#FAEEDA",
  warningText: "#7A4B0A",
};

// Contenedor de formularios: sube con el teclado y permite tocar fuera sin cerrarlo.
export function FormScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field({ label, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#999" accessibilityLabel={label} {...inputProps} />
    </View>
  );
}

type ButtonTone = "primary" | "secondary" | "danger";

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  tone = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: ButtonTone;
}) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.button, buttonTones[tone], inactive && styles.buttonInactive]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color={tone === "secondary" ? colors.primary : "white"} />
      ) : (
        <Text style={[styles.buttonText, tone === "secondary" && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.link} accessibilityRole="button" accessibilityLabel={title}>
      <Text style={styles.linkText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

const buttonTones = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { flexGrow: 1, padding: 16, justifyContent: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", color: colors.text },
  subtitle: { fontSize: 14, textAlign: "center", color: colors.muted, marginBottom: 12 },
  field: { gap: 4 },
  label: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  buttonInactive: { opacity: 0.6 },
  buttonText: { color: "white", fontSize: 15, fontWeight: "600" },
  buttonTextSecondary: { color: colors.primary },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: "500" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
