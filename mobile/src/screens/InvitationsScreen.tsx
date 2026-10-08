import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, Text, View } from "react-native";
import { useBackHandler } from "../hooks/useBackHandler";
import { errorMessage } from "../services/errors";
import { createInvitation, listInvitations, revokeInvitation } from "../services/invitationService";
import { ROLE_LABELS, type InvitableRole, type Invitation, type InvitationStatus, type SessionUser } from "../types";
import { Button, Chip, colors, ErrorText, LinkButton } from "../ui";

const ROLE_OPTIONS: { value: InvitableRole; label: string }[] = [
  { value: "EMPLOYEE", label: ROLE_LABELS.EMPLOYEE },
  { value: "SUPERVISOR", label: ROLE_LABELS.SUPERVISOR },
  { value: "BOOKKEEPER", label: ROLE_LABELS.BOOKKEEPER },
];
const DAY_OPTIONS = [1, 7, 30];

const STATUS_LABELS: Record<InvitationStatus, string> = {
  active: "Activo",
  expired: "Vencido",
  revoked: "Revocado",
};

// "ABCDEFGH" → "ABCD-EFGH" (el servidor acepta el código con o sin guion)
const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

async function shareInvitation(invitation: Invitation, organizationName: string) {
  try {
    await Share.share({
      message: `Únete a ${organizationName} en GeoCheck con el código ${formatCode(invitation.code)} (vence el ${formatDate(invitation.expiresAt)}).`,
    });
  } catch {
    // Compartir cancelado o no disponible: no es un error que mostrar.
  }
}

export default function InvitationsScreen({ user, onBack }: { user: SessionUser; onBack: () => void }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [role, setRole] = useState<InvitableRole>("EMPLOYEE");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackHandler(useCallback(() => onBack(), [onBack]));

  const load = useCallback(async () => {
    try {
      setInvitations(await listInvitations());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "No se pudieron cargar las invitaciones"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const invitation = await createInvitation({ role, expiresInDays: days });
      setInvitations((current) => [invitation, ...current]);
      await shareInvitation(invitation, user.organization.name);
    } catch (e) {
      setError(errorMessage(e, "No se pudo generar el código"));
    } finally {
      setCreating(false);
    }
  };

  const confirmRevoke = (invitation: Invitation) => {
    Alert.alert("Revocar código", `Nadie más podrá unirse con ${formatCode(invitation.code)}. Quienes ya se unieron conservan su acceso.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Revocar",
        style: "destructive",
        onPress: async () => {
          try {
            await revokeInvitation(invitation.id);
            await load();
          } catch (e) {
            setError(errorMessage(e, "No se pudo revocar el código"));
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Invitation }) => (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.code}>{formatCode(item.code)}</Text>
        <Text style={[styles.status, item.status !== "active" && styles.statusInactive]}>{STATUS_LABELS[item.status]}</Text>
      </View>
      <Text style={styles.itemMeta}>
        {ROLE_LABELS[item.role]} · vence {formatDate(item.expiresAt)} · {item.joinedCount} {item.joinedCount === 1 ? "persona se unió" : "personas se unieron"}
      </Text>
      {item.status === "active" ? (
        <View style={styles.itemActions}>
          <LinkButton title="Compartir" onPress={() => void shareInvitation(item, user.organization.name)} />
          <LinkButton title="Revocar" onPress={() => confirmRevoke(item)} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinkButton title="‹ Volver" onPress={onBack} />
      <Text style={styles.title}>Invitar personas</Text>

      <Text style={styles.label}>Rol</Text>
      <View style={styles.chips}>
        {ROLE_OPTIONS.map((option) => (
          <Chip key={option.value} label={option.label} selected={role === option.value} onPress={() => setRole(option.value)} />
        ))}
      </View>

      <Text style={styles.label}>Vigencia</Text>
      <View style={styles.chips}>
        {DAY_OPTIONS.map((option) => (
          <Chip key={option} label={`${option} ${option === 1 ? "día" : "días"}`} selected={days === option} onPress={() => setDays(option)} />
        ))}
      </View>

      <Button title="Generar y compartir código" onPress={handleCreate} loading={creating} />
      <ErrorText message={error} />

      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>Aún no hay invitaciones.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  label: { fontSize: 12, color: colors.muted, marginTop: 4 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  list: { paddingTop: 8, gap: 8 },
  item: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, gap: 4 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 20, fontWeight: "700", letterSpacing: 2, color: colors.text },
  status: { fontSize: 12, fontWeight: "600", color: colors.primary },
  statusInactive: { color: colors.muted },
  itemMeta: { fontSize: 12, color: colors.muted },
  itemActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 16 },
});
