import { describe, expect, it } from "vitest";
import type { Project } from "../types";
import {
  changedFields,
  draftFromProject,
  emptyDraft,
  formatCoords,
  isPoorAccuracy,
  mapsUrl,
  MAX_GEOFENCE_RADIUS_M,
  MIN_GEOFENCE_RADIUS_M,
  parseCoordinatePair,
  parseDraft,
  parseNumber,
  RADIUS_PRESETS,
  type ProjectDraft,
} from "./rules";

const project: Project = {
  id: "p1",
  organizationId: "o1",
  name: "Casa Reforma 245",
  latitude: 19.4284,
  longitude: -99.1677,
  geofenceRadius: 150,
  archived: false,
  createdAt: "2026-10-07T00:00:00.000Z",
};

const valid: ProjectDraft = { name: "Obra Norte", latitude: "19.4284", longitude: "-99.1677", radius: "150" };

describe("números escritos a mano", () => {
  it("acepta punto y coma decimal, signo y espacios", () => {
    expect(parseNumber("19.4284")).toBe(19.4284);
    expect(parseNumber("19,4284")).toBe(19.4284);
    expect(parseNumber(" -99,1677 ")).toBe(-99.1677);
    expect(parseNumber("+5")).toBe(5);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("7.")).toBe(7);
  });

  it("rechaza vacío, letras y formatos raros en vez de adivinar", () => {
    for (const bad of ["", "   ", "abc", "12abc", "1.2.3", "1,2,3", "--1", "1e5", "Infinity", "NaN", "0x10", "19.4284°"]) {
      expect(parseNumber(bad), bad).toBeNull();
    }
  });
});

describe("pegar el par de coordenadas de Google Maps", () => {
  const expected = { latitude: 18.9254, longitude: -99.2217 };

  it("acepta el formato que copia Google Maps y sus variantes comunes", () => {
    for (const text of [
      "18.9254, -99.2217",
      "18.9254,-99.2217",
      "  18.9254, -99.2217  ",
      "18.9254, -99.2217\n",
      "(18.9254, -99.2217)",
      "18.9254 -99.2217",
      "18.9254; -99.2217",
      "18.9254°, -99.2217°",
      "18,9254, -99,2217", // coma decimal
      "18,9254; -99,2217",
      "18.9254, −99.2217", // signo menos tipográfico
    ]) {
      expect(parseCoordinatePair(text), JSON.stringify(text)).toEqual(expected);
    }
  });

  it("conserva todos los decimales y admite enteros y signos explícitos", () => {
    expect(parseCoordinatePair("19.428412345, -99.167712345")).toEqual({ latitude: 19.428412345, longitude: -99.167712345 });
    expect(parseCoordinatePair("19, -99")).toEqual({ latitude: 19, longitude: -99 });
    expect(parseCoordinatePair("+19.5, +99.5")).toEqual({ latitude: 19.5, longitude: 99.5 });
  });

  it("rechaza lo que no es un par: un solo número, tres números, texto, grados y minutos, enlaces", () => {
    for (const bad of ["", "18.9254", "18.9254, -99.2217, 5", "abc, def", "18.9254, abc", "18°55'31.8\"N 99°13'18.2\"W", "https://maps.google.com/?q=18.9254,-99.2217"]) {
      expect(parseCoordinatePair(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("rechaza lo que cae fuera de rango; el caso típico es el orden invertido (longitud, latitud)", () => {
    expect(parseCoordinatePair("-99.2217, 18.9254")).toBeNull();
    expect(parseCoordinatePair("91, 0")).toBeNull();
    expect(parseCoordinatePair("0, 181")).toBeNull();
    expect(parseCoordinatePair("90, 180")).toEqual({ latitude: 90, longitude: 180 });
  });

  it("el resultado pasa la validación del formulario", () => {
    const pair = parseCoordinatePair("18.9254, -99.2217");
    expect(pair).not.toBeNull();
    const result = parseDraft({ name: "Obra", latitude: String(pair!.latitude), longitude: String(pair!.longitude), radius: "150" });
    expect(result.ok).toBe(true);
  });
});

describe("validación del formulario", () => {
  it("un formulario correcto produce los números y el nombre recortado", () => {
    const result = parseDraft({ ...valid, name: "  Obra Norte  ", latitude: "19,4284" });
    expect(result).toEqual({ ok: true, value: { name: "Obra Norte", latitude: 19.4284, longitude: -99.1677, geofenceRadius: 150 } });
  });

  it("el radio mínimo es 100 m y el máximo 1000 m, ambos incluidos", () => {
    expect(MIN_GEOFENCE_RADIUS_M).toBe(100);
    expect(MAX_GEOFENCE_RADIUS_M).toBe(1000);
    for (const radius of ["100", "1000", "150"]) expect(parseDraft({ ...valid, radius }).ok, radius).toBe(true);
    for (const radius of ["99", "20", "0", "-150", "1001"]) expect(parseDraft({ ...valid, radius }).ok, radius).toBe(false);
  });

  it("el mensaje del radio mínimo explica por qué", () => {
    const result = parseDraft({ ...valid, radius: "50" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.radius).toContain("100 m");
  });

  it("el radio debe ser entero y numérico", () => {
    expect(parseDraft({ ...valid, radius: "120.5" }).ok).toBe(false);
    expect(parseDraft({ ...valid, radius: "cien" }).ok).toBe(false);
    expect(parseDraft({ ...valid, radius: "" }).ok).toBe(false);
  });

  it("reporta cada campo inválido por separado", () => {
    const result = parseDraft({ name: " ", latitude: "91", longitude: "-181", radius: "10" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["latitude", "longitude", "name", "radius"]);
  });

  it("acepta los extremos de latitud y longitud y rechaza lo que pasa de ellos", () => {
    expect(parseDraft({ ...valid, latitude: "90", longitude: "180" }).ok).toBe(true);
    expect(parseDraft({ ...valid, latitude: "-90", longitude: "-180" }).ok).toBe(true);
    expect(parseDraft({ ...valid, latitude: "90.0001" }).ok).toBe(false);
    expect(parseDraft({ ...valid, longitude: "180.0001" }).ok).toBe(false);
  });

  it("el nombre admite hasta 120 caracteres", () => {
    expect(parseDraft({ ...valid, name: "x".repeat(120) }).ok).toBe(true);
    expect(parseDraft({ ...valid, name: "x".repeat(121) }).ok).toBe(false);
  });

  it("todos los radios de los atajos son válidos", () => {
    for (const radius of RADIUS_PRESETS) expect(parseDraft({ ...valid, radius: String(radius) }).ok, String(radius)).toBe(true);
  });
});

describe("borrador y cambios", () => {
  it("el borrador vacío empieza con el radio por defecto de 150 m", () => {
    expect(emptyDraft()).toEqual({ name: "", latitude: "", longitude: "", radius: "150" });
  });

  it("un proyecto guardado se convierte en un borrador que valida y no cambia nada", () => {
    const draft = draftFromProject(project);
    const parsed = parseDraft(draft);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(changedFields(project, parsed.value)).toEqual({});
  });

  it("changedFields envía solo lo que cambió", () => {
    expect(changedFields(project, { name: "Otro nombre", latitude: 19.4284, longitude: -99.1677, geofenceRadius: 150 })).toEqual({ name: "Otro nombre" });
    expect(changedFields(project, { name: project.name, latitude: 19.4284, longitude: -99.1677, geofenceRadius: 300 })).toEqual({ geofenceRadius: 300 });
  });

  it("si cambia la latitud o la longitud viajan las dos (la API las actualiza juntas)", () => {
    expect(changedFields(project, { name: project.name, latitude: 19.5, longitude: -99.1677, geofenceRadius: 150 })).toEqual({ latitude: 19.5, longitude: -99.1677 });
    expect(changedFields(project, { name: project.name, latitude: 19.4284, longitude: -99.2, geofenceRadius: 150 })).toEqual({ latitude: 19.4284, longitude: -99.2 });
  });
});

describe("utilidades de ubicación", () => {
  it("formatCoords usa 5 decimales (~1 m)", () => {
    expect(formatCoords(19.428412345, -99.167712345)).toBe("19.42841, -99.16771");
  });

  it("mapsUrl apunta al punto exacto", () => {
    expect(mapsUrl(19.4284, -99.1677)).toBe("https://www.google.com/maps/search/?api=1&query=19.4284,-99.1677");
  });

  it("una precisión peor que ±50 m es mala; sin dato no se avisa", () => {
    expect(isPoorAccuracy(50)).toBe(false);
    expect(isPoorAccuracy(50.1)).toBe(true);
    expect(isPoorAccuracy(null)).toBe(false);
  });
});
