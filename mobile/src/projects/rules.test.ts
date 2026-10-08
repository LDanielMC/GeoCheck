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
