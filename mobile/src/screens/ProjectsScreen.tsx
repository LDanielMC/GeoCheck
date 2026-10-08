import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useBackHandler } from "../hooks/useBackHandler";
import { formatCoords } from "../projects/rules";
import { errorMessage } from "../services/errors";
import { listProjects } from "../services/projectService";
import type { Project, SessionUser } from "../types";
import { Button, colors, ErrorText, LinkButton } from "../ui";

// Lista de proyectos de la organización. Todos los roles la ven; solo el ADMIN crea, edita y archiva.
export default function ProjectsScreen({
  user,
  onBack,
  onOpenProject,
}: {
  user: SessionUser;
  onBack: () => void;
  /** null = proyecto nuevo */
  onOpenProject: (project: Project | null) => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  useBackHandler(useCallback(() => onBack(), [onBack]));

  const load = useCallback(async () => {
    // Si el usuario cambia el filtro mientras carga, solo vale la respuesta más reciente.
    const request = ++latestRequest.current;
    setLoading(true);
    try {
      const result = await listProjects({ includeArchived: isAdmin && showArchived });
      if (request !== latestRequest.current) return;
      setProjects(result);
      setError(null);
    } catch (e) {
      if (request !== latestRequest.current) return;
      setError(errorMessage(e, "No se pudieron cargar los proyectos"));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [isAdmin, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const renderItem = ({ item }: { item: Project }) => (
    <TouchableOpacity style={[styles.item, item.archived && styles.itemArchived]} onPress={() => onOpenProject(item)} accessibilityRole="button" accessibilityLabel={`Proyecto ${item.name}`}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.archived ? <Text style={styles.badge}>Archivado</Text> : null}
      </View>
      <Text style={styles.itemMeta}>
        Radio {item.geofenceRadius} m · {formatCoords(item.latitude, item.longitude)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinkButton title="‹ Volver" onPress={onBack} />
      <Text style={styles.title}>Proyectos</Text>

      {isAdmin ? (
        <>
          <Button title="Nuevo proyecto" onPress={() => onOpenProject(null)} />
          <View style={styles.filter}>
            <Text style={styles.filterLabel}>Mostrar archivados</Text>
            <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: colors.primary }} />
          </View>
        </>
      ) : null}

      <ErrorText message={error} />

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading || error ? null : (
            <Text style={styles.empty}>
              {isAdmin
                ? "Aún no hay proyectos. Crea el primero para empezar a registrar horas por ubicación."
                : "Todavía no hay proyectos. Pídele a tu administrador que cree uno."}
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  filter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  filterLabel: { fontSize: 14, color: colors.text },
  list: { paddingTop: 8, gap: 8 },
  item: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, gap: 4 },
  itemArchived: { opacity: 0.65 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  itemName: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  badge: { fontSize: 11, fontWeight: "700", color: colors.warningText, backgroundColor: colors.warningBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  itemMeta: { fontSize: 12, color: colors.muted },
  empty: { textAlign: "center", color: colors.muted, marginTop: 16 },
});
