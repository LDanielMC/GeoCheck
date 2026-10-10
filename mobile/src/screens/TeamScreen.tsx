import React from "react";
import { Card, EmptyState, Screen, ScreenHeader } from "../design";
import { texts } from "../texts";

// Pestaña Equipo del supervisor: quién tiene un registro abierto y en qué obra llega en la rebanada 5. (El administrador
// ve aquí sus invitaciones.)
export default function TeamScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title={texts.team.title} />
      <Card>
        <EmptyState icon="team" title={texts.team.emptyTitle} message={texts.team.emptyMessage} />
      </Card>
    </Screen>
  );
}
