import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { AppText, Avatar, BottomSheet, Button, Card, colors, ListGroup, ListRow, Screen, ScreenHeader, spacing } from "../design";
import { useAuth } from "../context/AuthContext";
import { format, texts } from "../texts";
import { ROLE_LABELS, type SessionUser } from "../types";

// Pestaña Más: la configuración agrupada en Usuario, Empresa y Cuenta. Solo están los ajustes que funcionan hoy; el
// aviso del fichaje (vibración y sonido), el horario y el pago llegan con sus rebanadas.
export default function MoreScreen({ user, onOpenProfile, onOpenCompany }: { user: SessionUser; onOpenProfile: () => void; onOpenCompany: () => void }) {
  const { signOut } = useAuth();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // Los permisos de ubicación y las opciones de batería se cambian en los ajustes de Android de la app.
  const openSystemSettings = () => {
    Linking.openSettings().catch(() => undefined);
  };

  return (
    <Screen scroll>
      <ScreenHeader title={texts.more.title} />

      <Card style={styles.identity}>
        <Avatar name={user.name} />
        <View style={styles.identityText}>
          <AppText variant="heading" numberOfLines={1}>
            {user.name}
          </AppText>
          <AppText variant="small" color={colors.muted} numberOfLines={1}>
            {ROLE_LABELS[user.role]} · {user.organization.name}
          </AppText>
        </View>
      </Card>

      <ListGroup title={texts.more.userGroup}>
        <ListRow icon="user" label={texts.more.profile} onPress={onOpenProfile} />
        <ListRow icon="shield" label={texts.more.locationAndBattery} onPress={openSystemSettings} last />
      </ListGroup>

      <ListGroup title={texts.more.companyGroup}>
        <ListRow icon="building" label={texts.more.companyData} onPress={onOpenCompany} last />
      </ListGroup>

      <ListGroup title={texts.more.accountGroup}>
        <ListRow icon="exit" label={texts.more.signOut} tone="danger" onPress={() => setConfirmingSignOut(true)} last />
      </ListGroup>

      <AppText variant="caption" color={colors.muted} style={styles.version}>
        {format(texts.more.version, { version: Constants.expoConfig?.version ?? "" }).trim()}
      </AppText>

      <BottomSheet visible={confirmingSignOut} title={texts.more.signOutTitle} onClose={() => setConfirmingSignOut(false)}>
        <AppText variant="body" color={colors.muted}>
          {texts.more.signOutMessage}
        </AppText>
        <Button
          title={texts.more.signOut}
          tone="danger"
          onPress={() => {
            setConfirmingSignOut(false);
            void signOut();
          }}
        />
        <Button title={texts.common.cancel} tone="secondary" onPress={() => setConfirmingSignOut(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  identityText: { flex: 1 },
  version: { textAlign: "center", marginTop: spacing.sm },
});
