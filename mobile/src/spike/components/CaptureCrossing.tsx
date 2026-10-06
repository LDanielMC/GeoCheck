// Capturar un cruce DESPUÉS de hacerlo, con su hora real. Sirve cuando abrir la app o tocar la notificación
// contaminaría la prueba (escenarios 2 a 4) o cuando la notificación fija desapareció.

import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { minutesAgo, parseClock } from "../time";
import { Button, colors, ErrorText } from "../../ui";
import { Chip } from "./common";

const PRESETS = [0, 1, 2, 3, 5, 10, 15, 30];

export default function CaptureCrossing({ disabled, onSave }: { disabled: boolean; onSave: (type: "enter" | "exit", at: Date) => Promise<void> }) {
  const [type, setType] = useState<"enter" | "exit">("exit");
  const [preset, setPreset] = useState<number | null>(null);
  const [clock, setClock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    const now = new Date();
    let at: Date | null;
    if (clock.trim()) {
      at = parseClock(clock, now);
      if (!at) return setError("Escribe la hora como HH:MM o HH:MM:SS (24 h), por ejemplo 17:36 o 17:36:20.");
    } else if (preset != null) {
      at = minutesAgo(preset, now);
    } else {
      return setError("Elige «hace N min» o escribe la hora exacta.");
    }
    setSaving(true);
    try {
      await onSave(type, at);
      setClock("");
      setPreset(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Agregar cruce con hora</Text>
      <Text style={styles.hint}>Para cuando no pudiste marcar en el momento: se guarda con la hora real del cruce, no con la de ahora.</Text>
      <View style={styles.chips}>
        <Chip label="Entrada" selected={type === "enter"} onPress={() => setType("enter")} />
        <Chip label="Salida" selected={type === "exit"} onPress={() => setType("exit")} />
      </View>
      <View style={styles.chips}>
        {PRESETS.map((m) => (
          <Chip
            key={m}
            label={m === 0 ? "ahora" : `hace ${m} min`}
            selected={!clock.trim() && preset === m}
            onPress={() => {
              setClock("");
              setPreset(m);
            }}
          />
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="…o la hora exacta HH:MM:SS (24 h)"
        value={clock}
        onChangeText={(text) => {
          setClock(text);
          setPreset(null);
        }}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <ErrorText message={error} />
      <Button title="Guardar cruce" tone="secondary" disabled={disabled} loading={saving} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "white", borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: "white" },
});
