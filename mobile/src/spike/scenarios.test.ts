import { describe, expect, it } from "vitest";
import { renderScenario, SCENARIOS } from "./scenarios";

describe("escenarios", () => {
  it("hay 10 con ids únicos, incluido el diagnóstico de disparo por ubicación", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(SCENARIOS.find((s) => s.id === "10")?.title).toContain("algo pida ubicación");
  });

  it("todos dicen dónde empezar, cómo debe estar el teléfono, los pasos y cómo marcar", () => {
    for (const s of SCENARIOS) {
      expect(s.start.length, `start ${s.id}`).toBeGreaterThan(0);
      expect(s.phone.length, `phone ${s.id}`).toBeGreaterThan(0);
      expect(s.steps.length, `steps ${s.id}`).toBeGreaterThanOrEqual(2);
      expect(s.mark.length, `mark ${s.id}`).toBeGreaterThan(0);
      expect(s.repeat.length, `repeat ${s.id}`).toBeGreaterThan(0);
    }
  });

  it("renderScenario rellena todos los números y no deja marcadores sin sustituir", () => {
    for (const radius of [100, 150, 200]) {
      for (const s of SCENARIOS) {
        const r = renderScenario(s, radius, 50);
        const all = [r.start, r.phone, r.mark, r.repeat, r.recon, ...r.steps].join("\n");
        expect(all, `${s.id}@${radius}`).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });

  it("calcula las metas respecto al radio y al margen", () => {
    const r = renderScenario(SCENARIOS[0], 150, 50);
    expect(r.steps[1]).toContain("≥ 200 m del centro");
    expect(r.steps[4]).toContain("≤ 100 m del centro");
    expect(r.recon).toContain("50 m más afuera");
    expect(renderScenario(SCENARIOS.find((s) => s.id === "6")!, 150, 50).steps[0]).toContain("~120 m");
  });

  it("la meta de entrada nunca es negativa", () => {
    expect(renderScenario(SCENARIOS[0], 40, 50).steps[4]).toContain("≤ 0 m");
  });
});
