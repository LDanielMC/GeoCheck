import { es, type Texts } from "./es";

// Idioma activo. Hoy solo hay español; US-23 añadirá el inglés y la elección de idioma.
export const texts: Texts = es;
export type { Texts };

// Sustituye {nombre} por su valor. Una variable que falta se deja tal cual ({nombre}) para no romper la pantalla.
export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => (key in values ? String(values[key]) : placeholder));
}

export interface PluralText {
  one: string;
  other: string;
}

// Elige la forma según la cantidad y la sustituye también como {count}.
export function plural(count: number, text: PluralText, values: Record<string, string | number> = {}): string {
  return format(count === 1 ? text.one : text.other, { count, ...values });
}
