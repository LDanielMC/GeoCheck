import React, { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useBackHandler } from "../hooks/useBackHandler";
import {
  changedFields,
  draftFromProject,
  emptyDraft,
  isPoorAccuracy,
  mapsUrl,
  MAX_GEOFENCE_RADIUS_M,
  MIN_GEOFENCE_RADIUS_M,
  parseDraft,
  parseNumber,
  RADIUS_PRESETS,
  type DraftErrors,
  type ProjectDraft,
} from "../projects/rules";
import { errorMessage } from "../services/errors";
import { getCurrentLocation } from "../services/locationService";
import { createProject, updateProject } from "../services/projectService";
import type { Project, SessionUser } from "../types";
import { Button, Chip, colors, ErrorText, Field, FormScreen, LinkButton } from "../ui";

// Crear (project = null), editar (ADMIN) o ver (resto de roles) un proyecto.
export default function ProjectFormScreen({ user, project, onBack }: { user: SessionUser; project: Project | null; onBack: () => void }) {
  const canEdit = user.role === "ADMIN";
  const isNew = project === null;
  const [draft, setDraft] = useState<ProjectDraft>(() => (project ? draftFromProject(project) : emptyDraft()));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useBackHandler(useCallback(() => onBack(), [onBack]));

  const setField = (field: keyof ProjectDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const useMyLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const fix = await getCurrentLocation();
      setDraft((current) => ({ ...current, latitude: fix.latitude.toFixed(6), longitude: fix.longitude.toFixed(6) }));
      setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
      setAccuracy(fix.accuracy);
    } catch (e) {
      setError(errorMessage(e, "No se pudo obtener la ubicación"));
    } finally {
      setLocating(false);
    }
  };

  const openInMaps = () => {
    const latitude = parseNumber(draft.latitude);
    const longitude = parseNumber(draft.longitude);
    if (latitude === null || longitude === null) {
      setError("Escribe coordenadas válidas para ver el punto en el mapa.");
      return;
    }
    setError(null);
    Linking.openURL(mapsUrl(latitude, longitude)).catch(() => setError("No se pudo abrir la app de mapas."));
  };

  const save = async () => {
    setError(null);
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setSaving(true);
    try {
      if (project === null) {
        await createProject(parsed.value);
      } else {
        const changes = changedFields(project, parsed.value);
        if (Object.keys(changes).length > 0) await updateProject(project.id, changes);
      }
      onBack();
    } catch (e) {
      setError(errorMessage(e, "No se pudo guardar el proyecto"));
      setSaving(false);
    }
  };

  const confirmArchive = () => {
    if (project === null) return;
    const archiving = !project.archived;
    Alert.alert(
      archiving ? "Archivar proyecto" : "Restaurar proyecto",
      archiving
        ? "Dejará de aparecer en la lista y nadie podrá fichar en él. Las horas ya registradas se conservan y puedes restaurarlo cuando quieras."
        : "Volverá a aparecer en la lista y a admitir fichajes.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: archiving ? "Archivar" : "Restaurar",
          style: archiving ? "destructive" : "default",
          onPress: async () => {
            try {
              await updateProject(project.id, { archived: archiving });
              onBack();
            } catch (e) {
              setError(errorMessage(e, archiving ? "No se pudo archivar el proyecto" : "No se pudo restaurar el proyecto"));
            }
          },
        },
      ]
    );
  };

  const title = isNew ? "Nuevo proyecto" : canEdit ? "Editar proyecto" : "Proyecto";
  const subtitle = isNew ? "Párate en la obra y usa tu ubicación, o escribe las coordenadas." : undefined;

  return (
    <FormScreen title={title} subtitle={subtitle}>
      <LinkButton title="‹ Volver" onPress={onBack} />
      {project?.archived ? <Text style={styles.archivedNotice}>Este proyecto está archivado: no admite fichajes.</Text> : null}

      <Field label="Nombre de la obra" value={draft.name} onChangeText={setField("name")} editable={canEdit} maxLength={120} />
      <FieldError message={errors.name} />

      <Text style={styles.label}>Radio de la geocerca</Text>
      {canEdit ? (
        <View style={styles.chips}>
          {RADIUS_PRESETS.map((preset) => (
            <Chip key={preset} label={`${preset} m`} selected={draft.radius === String(preset)} onPress={() => setField("radius")(String(preset))} />
          ))}
        </View>
      ) : null}
      <Field label="Metros" value={draft.radius} onChangeText={setField("radius")} editable={canEdit} keyboardType="number-pad" />
      <FieldError message={errors.radius} />
      {canEdit ? (
        <Text style={styles.hint}>
          Mínimo {MIN_GEOFENCE_RADIUS_M} m y máximo {MAX_GEOFENCE_RADIUS_M} m. Con radios chicos la detección automática falla más; 150 m es un buen punto de partida.
        </Text>
      ) : null}

      <Text style={styles.label}>Ubicación</Text>
      {canEdit ? <Button title="Usar mi ubicación actual" tone="secondary" onPress={useMyLocation} loading={locating} /> : null}
      {accuracy != null ? (
        <Text style={[styles.hint, isPoorAccuracy(accuracy) && styles.warning]}>
          Precisión del GPS: ±{Math.round(accuracy)} m.{isPoorAccuracy(accuracy) ? " Es baja: espera unos segundos a cielo abierto y vuelve a intentarlo." : ""}
        </Text>
      ) : null}
      <Field label="Latitud" value={draft.latitude} onChangeText={setField("latitude")} editable={canEdit} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
      <FieldError message={errors.latitude} />
      <Field label="Longitud" value={draft.longitude} onChangeText={setField("longitude")} editable={canEdit} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
      <FieldError message={errors.longitude} />
      <LinkButton title="Ver el punto en el mapa" onPress={openInMaps} />

      <ErrorText message={error} />
      {canEdit ? <Button title={isNew ? "Crear proyecto" : "Guardar cambios"} onPress={save} loading={saving} /> : null}
      {canEdit && project !== null ? (
        <Button title={project.archived ? "Restaurar proyecto" : "Archivar proyecto"} tone={project.archived ? "secondary" : "danger"} onPress={confirmArchive} />
      ) : null}
    </FormScreen>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : null;
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: colors.muted, marginTop: 4 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  warning: { color: colors.warningText },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: -6 },
  archivedNotice: { backgroundColor: colors.warningBg, color: colors.warningText, borderRadius: 8, padding: 10, fontSize: 13, textAlign: "center" },
});
