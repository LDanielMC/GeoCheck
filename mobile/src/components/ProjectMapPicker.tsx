import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Circle, Marker, type MapPressEvent, type MarkerDragStartEndEvent } from "react-native-maps";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DEFAULT_REGION, regionForCircle, roundCoordinate, stepRadius, type LatLng } from "../projects/mapRegion";
import { formatCoords, RADIUS_PRESETS } from "../projects/rules";
import { AddressSearchError, searchAddress, type AddressResult } from "../services/addressSearch";
import { getPositionForMap, hasLocationAccess } from "../services/locationService";
import { fetchSuggestions, MIN_SUGGEST_LENGTH, newSessionToken, resolveSuggestion, type AddressSuggestion } from "../services/placesApi";
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

// Espera tras la última tecla antes de pedir sugerencias: cada petición se cuenta en la cuota de Google.
const SUGGEST_DEBOUNCE_MS = 300;

// Selector de ubicación en pantalla completa: escribe una dirección (con sugerencias de Google a través del backend y, si
// no hay servicio, el buscador del teléfono), toca el mapa o arrastra el pin, y ajusta el radio viendo el círculo. Se
// monta al abrirlo (el estado parte de `initial`) y devuelve el resultado solo al confirmar.
export default function ProjectMapPicker({ initial, readOnly = false, onConfirm, onClose }: Props) {
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<LatLng | null>(initial.center);
  const [radius, setRadius] = useState(initial.radius);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestionsDown, setSuggestionsDown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [here, setHere] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  // Sesión de autocompletado de Google: se renueva al elegir una dirección (ahí termina el cobro de esa búsqueda).
  const sessionRef = useRef(newSessionToken());
  // Cada petición de sugerencias lleva un número: una respuesta tardía de una consulta vieja se descarta.
  const suggestSeq = useRef(0);
  // Texto que puso la propia pantalla al elegir una sugerencia: no debe volver a pedir sugerencias.
  const filledQuery = useRef<string | null>(null);
  // Cuando la persona ya colocó el pin o movió el mapa, el centrado automático en su ubicación no debe quitárselo.
  const touched = useRef(false);

  const showCircle = (center: LatLng, nextRadius: number) => mapRef.current?.animateToRegion(regionForCircle(center, nextRadius), 500);

  const choose = (place: LatLng) => {
    touched.current = true;
    setPin(place);
    setMessage(null);
  };

  // Punto azul de «mi ubicación» y, en una obra nueva, centrar el mapa en la persona. El permiso se pide al abrir solo a quien
  // edita; quien solo mira ve el punto únicamente si ya había dado el permiso.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await hasLocationAccess(!readOnly))) return;
        if (cancelled) return;
        setLocationGranted(true);
        if (initial.center || readOnly) return;
        const position = await getPositionForMap({ fresh: false });
        if (!cancelled && position) setHere(position);
      } catch {
        // sin ubicación el mapa se queda en su vista inicial
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  // Se espera a que el mapa esté listo: antes, animateToRegion se pierde en Android.
  useEffect(() => {
    if (mapReady && here && !touched.current) showCircle(here, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llegan la posición o el mapa
  }, [mapReady, here]);

  const centerOnMe = async () => {
    setMessage(null);
    setLocating(true);
    try {
      if (!(await hasLocationAccess(true))) {
        setMessage("Activa el permiso de ubicación en los ajustes del teléfono para centrar el mapa en ti.");
        return;
      }
      setLocationGranted(true);
      const position = await getPositionForMap({ fresh: true });
      if (position) showCircle(position, radius);
      else setMessage("No se pudo obtener tu ubicación. Revisa que la ubicación del teléfono esté encendida e inténtalo de nuevo.");
    } finally {
      setLocating(false);
    }
  };

  // Sugerencias mientras se escribe.
  useEffect(() => {
    if (readOnly) return;
    if (filledQuery.current !== null && filledQuery.current === query) return;
    const text = query.trim();
    const seq = ++suggestSeq.current;
    if (text.length < MIN_SUGGEST_LENGTH) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const found = await fetchSuggestions(text, sessionRef.current);
      if (seq !== suggestSeq.current) return;
      setSuggestionsDown(found === null);
      setSuggestions(found ?? []);
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, readOnly]);

  const pickSuggestion = async (suggestion: AddressSuggestion) => {
    Keyboard.dismiss();
    suggestSeq.current++; // descarta sugerencias que aún vengan en camino
    setMessage(null);
    setSuggestions([]);
    setSearching(true);
    try {
      const place = await resolveSuggestion(suggestion, sessionRef.current);
      sessionRef.current = newSessionToken(); // Place Details cerró la sesión de cobro
      filledQuery.current = suggestion.description;
      setQuery(suggestion.description);
      choose(place);
      showCircle(place, radius);
      setResults([place]);
    } catch (e) {
      setMessage(e instanceof AddressSearchError ? e.message : "No se pudo ubicar esa dirección.");
    } finally {
      setSearching(false);
    }
  };

  // «Buscar»: primero Google (por si se tecleó rápido y aún no hay sugerencias); si no hay servicio o no encuentra nada,
  // el geocodificador del teléfono.
  const runSearch = async () => {
    Keyboard.dismiss();
    setMessage(null);
    setResults([]);
    setSuggestions([]);
    suggestSeq.current++;
    setSearching(true);
    try {
      const found = await fetchSuggestions(query, sessionRef.current);
      setSuggestionsDown(found === null);
      if (found && found.length === 1) {
        await pickSuggestion(found[0]);
        return;
      }
      if (found && found.length > 1) {
        setSuggestions(found);
        return;
      }

      const phone = await searchAddress(query);
      if (phone.length === 0) {
        setMessage("No se encontró esa dirección. Prueba con calle, número, ciudad y estado (por ejemplo «1600 Pennsylvania Ave NW, Washington, DC»), o toca el mapa.");
      } else if (phone.length === 1) {
        // Lo normal: una sola coincidencia. Se coloca el pin y se muestra cómo la entendió el teléfono.
        choose(phone[0]);
        showCircle(phone[0], radius);
        setResults(phone);
      } else {
        setResults(phone);
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
              {suggestions.length > 0 ? (
                <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                  {suggestions.map((suggestion) => (
                    <TouchableOpacity key={suggestion.placeId} style={styles.result} onPress={() => pickSuggestion(suggestion)} accessibilityRole="button">
                      <Text style={styles.resultLabel}>{suggestion.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : results.length > 1 ? (
                <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                  {results.map((result) => (
                    <TouchableOpacity key={`${result.latitude},${result.longitude}`} style={styles.result} onPress={() => pickResult(result)} accessibilityRole="button">
                      <Text style={styles.resultLabel}>{result.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : results.length === 1 ? (
                <Text style={styles.found}>Encontrado: {results[0].label}</Text>
              ) : suggestionsDown && query.trim().length >= MIN_SUGGEST_LENGTH ? (
                <Text style={styles.hint}>Sin sugerencias por ahora: escribe la dirección completa y toca «Buscar».</Text>
              ) : null}
            </View>
          )}

          <View style={styles.mapBox}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              initialRegion={initial.center ? regionForCircle(initial.center, initial.radius) : DEFAULT_REGION}
              onPress={readOnly ? undefined : (event: MapPressEvent) => choose(event.nativeEvent.coordinate)}
              onMapReady={() => setMapReady(true)}
              onPanDrag={() => {
                touched.current = true;
              }}
              showsUserLocation={locationGranted}
              showsMyLocationButton={false}
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
            <TouchableOpacity style={styles.locate} onPress={centerOnMe} disabled={locating} accessibilityRole="button" accessibilityLabel="Centrar el mapa en mi ubicación">
              <Text style={styles.locateText}>{locating ? "Buscando…" : "◎ Mi ubicación"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            {readOnly ? <ErrorText message={message} /> : null}
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
  mapBox: { flex: 1 },
  locate: { position: "absolute", right: 12, bottom: 12, backgroundColor: "white", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, elevation: 4, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  locateText: { fontSize: 13, fontWeight: "600", color: colors.text },
  footer: { padding: 16, gap: 8 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  radiusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
