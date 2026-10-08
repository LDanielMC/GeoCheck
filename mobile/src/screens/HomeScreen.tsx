import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS, type SessionUser } from "../types";
import { Button, colors } from "../ui";

// Pantalla de inicio por rol. El fichaje (ClockScreen) se conecta en el spike de geofencing y la rebanada 2.
export default function HomeScreen({
  user,
  offline,
  onOpenProjects,
  onOpenInvitations,
}: {
  user: SessionUser;
  offline: boolean;
  onOpenProjects: () => void;
  onOpenInvitations: () => void;
}) {
  const { signOut, refresh } = useAuth();

  return (
    <View style={styles.container}>
      {offline ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Sin conexión con el servidor. Mostrando tu última sesión.</Text>
          <Button title="Reintentar" tone="secondary" onPress={() => void refresh()} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.organization}>{user.organization.name}</Text>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.role}>{ROLE_LABELS[user.role]}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <Button title="Proyectos" onPress={onOpenProjects} />

      {user.role === "ADMIN" ? (
        <Button title="Invitar personas" tone="secondary" onPress={onOpenInvitations} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.info}>El fichaje automático por ubicación estará disponible pronto.</Text>
        </View>
      )}

      <Button title="Cerrar sesión" tone="secondary" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center", gap: 12 },
  banner: { backgroundColor: colors.warningBg, borderRadius: 8, padding: 12, gap: 8 },
  bannerText: { color: colors.warningText, fontSize: 13, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: "center", gap: 4 },
  organization: { fontSize: 12, color: colors.muted },
  name: { fontSize: 22, fontWeight: "600", color: colors.text },
  role: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  email: { fontSize: 12, color: colors.muted },
  info: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
