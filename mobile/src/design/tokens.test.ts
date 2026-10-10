import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { FONT_FACES } from "./fontFaces";
import { initials } from "./initials";
import { colors, radius, spacing, TOUCH_MIN, typeScale } from "./tokens";

const projectRoot = new URL("../../", import.meta.url);

describe("contraste de la paleta (WCAG AA)", () => {
  // [texto, fondo, mínimo]: 4.5 para texto, 3 para bordes y componentes.
  const pairs: [keyof typeof colors, keyof typeof colors, number][] = [
    ["text", "paper", 4.5],
    ["text", "card", 4.5],
    ["muted", "card", 4.5],
    ["muted", "paper", 4.5],
    ["onPrimary", "primary", 4.5],
    ["onPrimary", "primaryDark", 4.5],
    ["primary", "card", 4.5],
    ["primary", "primaryTint", 4.5],
    ["onPrimary", "danger", 4.5],
    ["onPrimary", "dangerDark", 4.5],
    ["danger", "card", 4.5],
    ["danger", "dangerTint", 4.5],
    ["text", "accent", 4.5],
    ["text", "accentDark", 4.5],
    ["accentText", "accentTint", 4.5],
    ["edge", "card", 3],
    ["edge", "paper", 3],
  ];

  it.each(pairs)("%s sobre %s cumple %s a 1", (foreground, background, minimum) => {
    expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(minimum);
  });

  it("calcula bien el caso límite conocido: negro sobre blanco = 21 a 1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("escala tipográfica y medidas", () => {
  it("el texto de lectura no baja de 13; solo la etiqueta en mayúsculas llega a 12", () => {
    for (const [name, spec] of Object.entries(typeScale)) {
      expect(spec.size, name).toBeGreaterThanOrEqual(name === "label" ? 12 : 13);
      expect(spec.lineHeight, name).toBeGreaterThanOrEqual(spec.size);
    }
  });

  it("los botones y las filas tocables miden al menos 48", () => {
    expect(TOUCH_MIN).toBeGreaterThanOrEqual(48);
  });

  it("el espacio sigue la escala de 4", () => {
    for (const value of Object.values(spacing)) expect(value % 4).toBe(0);
    expect(radius.pill).toBeGreaterThan(100);
  });

  it("el cronómetro usa cifras de ancho fijo", () => {
    expect("tabularNumbers" in typeScale.timer && typeScale.timer.tabularNumbers).toBe(true);
  });

  it("cada tamaño usa una cara de la tipografía que existe", () => {
    for (const spec of Object.values(typeScale)) expect(FONT_FACES[spec.face]).toBeDefined();
  });
});

describe("tipografías incrustadas", () => {
  const appJson = JSON.parse(readFileSync(new URL("app.json", projectRoot), "utf8")).expo;
  const fontPlugin = appJson.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-font");

  it("todos los archivos existen en node_modules", () => {
    for (const face of Object.values(FONT_FACES)) {
      expect(existsSync(new URL(face.file, projectRoot)), face.file).toBe(true);
    }
  });

  it("en Android el nombre de familia es el nombre del archivo (así lo toma Expo)", () => {
    for (const face of Object.values(FONT_FACES)) {
      expect(basename(face.file, ".ttf")).toBe(face.android);
    }
  });

  it("el plugin expo-font de app.json incrusta exactamente estas tipografías", () => {
    expect(fontPlugin).toBeDefined();
    expect([...fontPlugin[1].fonts].sort()).toEqual(Object.values(FONT_FACES).map((face) => face.file).sort());
  });

  it("el nombre de iOS es el nombre PostScript que trae cada archivo", () => {
    for (const face of Object.values(FONT_FACES)) {
      expect(postScriptName(readFileSync(new URL(face.file, projectRoot))), face.file).toBe(face.ios);
    }
  });
});

// Lee el nombre PostScript (id 6) de la tabla `name` de un archivo TTF.
function postScriptName(file: Buffer): string | null {
  const tables = file.readUInt16BE(4);
  let nameOffset: number | null = null;
  for (let i = 0; i < tables; i++) {
    if (file.toString("ascii", 12 + i * 16, 16 + i * 16) === "name") nameOffset = file.readUInt32BE(20 + i * 16);
  }
  if (nameOffset === null) return null;
  const count = file.readUInt16BE(nameOffset + 2);
  const stringsOffset = nameOffset + file.readUInt16BE(nameOffset + 4);
  for (let i = 0; i < count; i++) {
    const record = nameOffset + 6 + i * 12;
    const platform = file.readUInt16BE(record);
    const id = file.readUInt16BE(record + 6);
    if (id !== 6 || platform !== 3) continue;
    const length = file.readUInt16BE(record + 8);
    const start = stringsOffset + file.readUInt16BE(record + 10);
    return Buffer.from(file.subarray(start, start + length)).swap16().toString("utf16le");
  }
  return null;
}

describe("iniciales del avatar", () => {
  it("toma la primera letra de las dos primeras palabras, en mayúscula", () => {
    expect(initials("Luis Daniel Moctezuma")).toBe("LD");
    expect(initials("  luis   daniel ")).toBe("LD");
    expect(initials("Ana")).toBe("A");
    expect(initials("ángel ñuñez")).toBe("ÁÑ");
  });

  it("sin nombre devuelve un signo de interrogación", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
