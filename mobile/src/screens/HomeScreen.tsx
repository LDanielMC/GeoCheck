import React from "react";
import { Card, EmptyState, Screen, ScreenHeader } from "../design";
import { texts } from "../texts";

// Pestaña Inicio. El estado grande («Dentro de [obra] desde 7:02 · automático» / «Fuera de obra») y el botón manual de
// respaldo llegan con el fichaje real (rebanada 2); aquí queda su lugar.
export default function HomeScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title={texts.home.title} />
      <Card>
        <EmptyState icon="home" title={texts.home.emptyTitle} message={texts.home.emptyMessage} />
      </Card>
    </Screen>
  );
}
