import React from "react";
import { Card, EmptyState, Screen, ScreenHeader } from "../design";
import { texts } from "../texts";

// Pestaña Registros. La línea de tiempo por día, el resumen de la semana y las correcciones con motivo (US-09) se
// construyen en la rebanada 2; aquí queda su lugar.
export default function RecordsScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title={texts.records.title} />
      <Card>
        <EmptyState icon="records" title={texts.records.emptyTitle} message={texts.records.emptyMessage} />
      </Card>
    </Screen>
  );
}
