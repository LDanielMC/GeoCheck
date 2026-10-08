import React, { useRef, useState } from "react";
import { Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Circle, Marker, type MapPressEvent, type MarkerDragStartEndEvent } from "react-native-maps";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DEFAULT_REGION, regionForCircle, roundCoordinate, stepRadius, type LatLng } from "../projects/mapRegion";
import { formatCoords, RADIUS_PRESETS } from "../projects/rules";
import { AddressSearchError, searchAddress, type AddressResult } from "../services/addressSearch";
import { Button, Chip, colors, ErrorText, LinkButton } from "../ui";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  radius: number;
}

interface Props {
  initial: { center: LatLng | null; radius: number };
  /** Solo ver el punto y el círculo (roles que no editan proyectos). */
  readOnly?: boolean;
  onConfirm: (value: PickedLocation) => void;
  onClose: () => void;
}

// Selector de ubicación en pantalla completa: busca una dirección, toca el mapa o arrastra el pin, y ajusta el radio
// viendo el círculo. Se monta al abrirlo (el estado parte de `initial`) y devuelve el resultado solo al confirmar.
export default function ProjectMapPicker({ initial, readOnly = false, onConfirm, onClose }: Props) {
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<LatLng | null>(initial.center);
  const [radius, setRadius] = useState(initial.radius);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const showCircle = (center: LatLng, nextRadius: number) => mapRef.current?.animateToRegion(regionForCircle(center, nextRadius), 500);

  const choose = (place: LatLng) => {
    setPin(place);
    setMessage(null);
  };

  const runSearch = async () => {
    Keyboard.dismiss();
    setMessage(null);
    setResults([]);
    setSearching(true);
    try {
      const found = await searchAddress(query);
      if (found.length === 0) {
        setMessage("No se encontró esa dirección. Prueba con calle, número, ciudad y estado (por ejemplo «1600 Pennsylvania Ave NW, Washington, DC»), o toca el mapa.");
      } else if (found.length === 1) {
        // Lo normal: una sola coincidencia. Se coloca el pin y se muestra cómo la entendió el teléfono.
        choose(found[0]);
        showCircle(found[0], radius);
        setResults(found);
      } else {
        setResults(found);
      }
    } catch (e) {
      setMessage(e instanceof AddressSearchError ? e.message : "No se pudo buscar la dirección.");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (result: AddressResult) => {
    choose(result);
    showCircle(result, radius);
  };

  const changeRadius = (next: number) => {
    setRadius(next);
    if (pin) showCircle(pin, next);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <LinkButton title="‹ Cancelar" onPress={onClose} />
            <Text style={styles.title}>Ubicación de la obra</Text>
          </View>

          {readOnly ? null : (
            <View style={styles.search}>
              <TextInput
                style={styles.input}
                placeholder="Dirección: calle, número, ciudad, estado"
                placeholderTextColor="#999"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={runSearch}
                autoCorrect={false}
                accessibilityLabel="Dirección a buscar"
              />
              <Button title="Buscar" onPress={runSearch} loading={searching} disabled={query.trim().length === 0} />
              <ErrorText message={message} />
              {results.length > 1 ? (
                <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                  {results.map((result) => (
                    <TouchableOpacity key={`${result.latitude},${result.longitude}`} style={styles.result} onPress={() => pickResult(result)} accessibilityRole="button">
                      <Text style={styles.resultLabel}>{result.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : results.length === 1 ? (
                <Text style={styles.found}>Encontrado: {results[0].label}</Text>
              ) : null}
            </View>
          )}

          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initial.center ? regionForCircle(initial.center, initial.radius) : DEFAULT_REGION}
            onPress={readOnly ? undefined : (event: MapPressEvent) => choose(event.nativeEvent.coordinate)}
            toolbarEnabled={false}
            accessibilityLabel="Mapa de la obra"
          >
            {pin ? (
              <>
                <Circle center={pin} radius={radius} strokeColor="rgba(59,109,17,0.95)" fillColor="rgba(59,109,17,0.2)" strokeWidth={2} />
                <Marker coordinate={pin} draggable={!readOnly} onDragEnd={(event: MarkerDragStartEndEvent) => choose(event.nativeEvent.coordinate)} />
              </>
            ) : null}
          </MapView>

          <View style={styles.footer}>
            <Text style={styles.hint}>
              {pin
                ? `${formatCoords(pin.latitude, pin.longitude)} · radio ${radius} m`
                : readOnly
                  ? "Este proyecto aún no tiene ubicación."
                  : "Busca una dirección o toca el mapa para colocar el pin."}
            </Text>
            {readOnly ? null : (
              <>
                <Text style={styles.hint}>Toca el mapa o arrastra el pin para mover el centro. El círculo verde es la geocerca.</Text>
                <View style={styles.radiusRow}>
                  <Chip label="−50 m" selected={false} onPress={() => changeRadius(stepRadius(radius, -50))} />
                  {RADIUS_PRESETS.map((preset) => (
                    <Chip key={preset} label={`${preset} m`} selected={radius === preset} onPress={() => changeRadius(preset)} />
                  ))}
                  <Chip label="+50 m" selected={false} onPress={() => changeRadius(stepRadius(radius, 50))} />
                </View>
                <Button
                  title="Usar esta ubicación"
                  disabled={!pin}
                  onPress={() => pin && onConfirm({ latitude: roundCoordinate(pin.latitude), longitude: roundCoordinate(pin.longitude), radius })}
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  search: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text },
  results: { maxHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  result: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultLabel: { fontSize: 14, color: colors.text },
  found: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  map: { flex: 1 },
  footer: { padding: 16, gap: 8 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  radiusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
