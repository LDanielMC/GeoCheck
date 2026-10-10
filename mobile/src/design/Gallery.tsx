import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Avatar } from "./Avatar";
import { Banner } from "./Banner";
import { BottomSheet } from "./BottomSheet";
import { BrandMark } from "./BrandMark";
import { Button, Fab, IconButton, LinkButton } from "./Button";
import { Card } from "./Card";
import { Badge, Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
import { Field } from "./Field";
import { Icon, ICON_NAMES } from "./Icon";
import { ListGroup, ListRow } from "./ListGroup";
import { colors, spacing, typeScale, type ColorName, type TextVariant } from "./tokens";

// Galería de la base visual: solo para comprobar en el teléfono que las piezas se ven como en la maqueta. Se abre con el
// development build y EXPO_PUBLIC_DESIGN_GALLERY=1 (README). No es una pantalla de la app, así que sus textos de muestra no
// van en src/texts.
const SWATCHES: ColorName[] = ["primary", "primaryTint", "accent", "accentTint", "danger", "dangerTint", "text", "muted", "paper", "card", "line", "edge"];

export default function Gallery() {
  const [sheet, setSheet] = useState(false);
  const [chip, setChip] = useState("Todas");

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size={96} />
        <View style={styles.flex}>
          <AppText variant="hero">GeoCheck</AppText>
          <AppText variant="small" color={colors.muted}>
            Base visual · rebanada D0
          </AppText>
        </View>
      </View>

      <Section title="Color">
        <View style={styles.swatches}>
          {SWATCHES.map((name) => (
            <View key={name} style={styles.swatch}>
              <View style={[styles.chipColor, { backgroundColor: colors[name] }]} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Tipografía">
        {(Object.keys(typeScale) as TextVariant[]).map((variant) => (
          <AppText key={variant} variant={variant}>
            {variant === "timer" ? "02:14:37" : `${variant} · Casa Reforma 1200`}
          </AppText>
        ))}
      </Section>

      <Section title="Íconos">
        <View style={styles.icons}>
          {ICON_NAMES.map((name) => (
            <View key={name} style={styles.icon}>
              <Icon name={name} size={28} />
              <AppText variant="caption" color={colors.muted}>
                {name}
              </AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Botones">
        <Button title="Guardar obra" onPress={() => undefined} />
        <Button title="Cancelar" tone="secondary" onPress={() => undefined} />
        <Button title="Registrar salida" tone="danger" icon="stop" onPress={() => undefined} />
        <Button title="Revisar" tone="accent" onPress={() => undefined} />
        <Button title="Registrar entrada" size="large" icon="play" onPress={() => undefined} />
        <Button title="Guardando" loading onPress={() => undefined} />
        <Button title="Desactivado" disabled onPress={() => undefined} />
        <LinkButton title="Enlace" onPress={() => undefined} />
        <View style={styles.row}>
          <IconButton icon="locate" label="Mi ubicación" onPress={() => undefined} />
          <IconButton icon="layers" label="Capas" onPress={() => undefined} />
          <IconButton icon="back" label="Atrás" tone="primary" onPress={() => undefined} />
          <Fab icon="add" label="Agregar" onPress={() => undefined} />
        </View>
      </Section>

      <Section title="Chips y etiquetas">
        <View style={styles.row}>
          {["Todas", "Cerca de mí", "Archivadas"].map((label) => (
            <Chip key={label} label={label} selected={chip === label} onPress={() => setChip(label)} />
          ))}
        </View>
        <View style={styles.row}>
          <Badge label="Radio 150 m" />
          <Badge label="Archivada" tone="warning" />
          <Badge label="Sin salida" tone="danger" />
          <Badge label="Pendiente" tone="neutral" />
        </View>
      </Section>

      <Section title="Campos, tarjetas y avisos">
        <Field label="Nombre de la obra" placeholder="Casa Reforma" />
        <Field label="Con error" value="x" error="El nombre es obligatorio" onChangeText={() => undefined} />
        <Field label="Solo lectura" value="Administrador" editable={false} />
        <Card>
          <View style={styles.row}>
            <Avatar name="Luis Daniel" />
            <View style={styles.flex}>
              <AppText variant="heading">Luis Daniel</AppText>
              <AppText variant="small" color={colors.muted}>
                Administrador
              </AppText>
            </View>
          </View>
        </Card>
        <Banner message="Sin conexión con el servidor. Mostrando tu última sesión." />
        <Banner tone="error" title="No se pudo guardar" message="Revisa tu conexión e inténtalo de nuevo." />
        <Banner tone="info" message="El borde no debe quedar donde la gente pasa mucho tiempo." />
      </Section>

      <Section title="Pantalla vacía y filas">
        <Card>
          <EmptyState icon="projects" title="Aún no hay obras" message="Crea la primera para empezar a registrar horas por ubicación." actionLabel="Crear obra" onAction={() => undefined} />
        </Card>
        <ListGroup title="Usuario">
          <ListRow icon="user" label="Mi perfil" onPress={() => undefined} />
          <ListRow icon="shield" label="Ubicación y batería" value="Activada" onPress={() => undefined} />
          <ListRow icon="exit" label="Cerrar sesión" tone="danger" last onPress={() => undefined} />
        </ListGroup>
      </Section>

      <Section title="Hoja inferior">
        <Button title="Abrir hoja" tone="secondary" onPress={() => setSheet(true)} />
      </Section>

      <BottomSheet visible={sheet} title="¿Archivar «Duplex Alberta»?" onClose={() => setSheet(false)}>
        <AppText variant="body" color={colors.muted}>
          Nadie podrá fichar en ella. Las horas ya registradas se conservan.
        </AppText>
        <Button title="Archivar" tone="danger" onPress={() => setSheet(false)} />
        <Button title="Cancelar" tone="secondary" onPress={() => setSheet(false)} />
      </BottomSheet>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" color={colors.muted}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  flex: { flex: 1 },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  section: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatch: { width: 84, gap: spacing.xs },
  chipColor: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  icon: { width: 76, alignItems: "center", gap: spacing.xs },
});
