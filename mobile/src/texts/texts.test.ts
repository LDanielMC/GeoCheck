import { describe, expect, it } from "vitest";
import { format, plural, texts } from ".";
import { es } from "./es";

function collect(node: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof node === "string") return [{ path: path.join("."), value: node }];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) => collect(child, [...path, key]));
}

describe("archivo de textos en español", () => {
  const all = collect(es);

  it("no tiene textos vacíos ni con espacios sobrantes", () => {
    expect(all.length).toBeGreaterThan(10);
    for (const { path, value } of all) {
      expect(value.length, path).toBeGreaterThan(0);
      expect(value, path).toBe(value.trim());
    }
  });

  it("las variables se escriben {nombre}, sin llaves sueltas", () => {
    for (const { path, value } of all) {
      const withoutVariables = value.replace(/\{\w+\}/g, "");
      expect(withoutVariables, path).not.toMatch(/[{}]/);
    }
  });

  it("cubre todos los roles y todas las pestañas de la barra inferior", () => {
    expect(Object.keys(texts.roles).sort()).toEqual(["ADMIN", "BOOKKEEPER", "EMPLOYEE", "SUPERVISOR"]);
    expect(Object.keys(texts.tabs)).toEqual(["home", "projects", "records", "team", "more"]);
  });
});

describe("format", () => {
  it("sustituye las variables, también si se repiten", () => {
    expect(format("Vence el {date}. {date}", { date: "8 oct" })).toBe("Vence el 8 oct. 8 oct");
    expect(format("{n} m", { n: 150 })).toBe("150 m");
  });

  it("deja tal cual una variable que falta, en vez de romper la pantalla", () => {
    expect(format("Hola {name}")).toBe("Hola {name}");
  });

  it("no toca textos sin variables", () => {
    expect(format("Sin variables")).toBe("Sin variables");
  });
});

describe("plural", () => {
  const text = { one: "{count} persona se unió", other: "{count} personas se unieron" };

  it("elige la forma por la cantidad y la sustituye en el texto", () => {
    expect(plural(1, text)).toBe("1 persona se unió");
    expect(plural(0, text)).toBe("0 personas se unieron");
    expect(plural(5, text)).toBe("5 personas se unieron");
  });

  it("admite más variables", () => {
    expect(plural(2, { one: "{n} día en {where}", other: "{count} días en {where}" }, { where: "obra" })).toBe("2 días en obra");
  });
});
