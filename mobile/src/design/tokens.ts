// Identidad visual de GeoCheck (rebanada D). Propuesta aprobada el 2026-10-10: verde obra, amarillo chaleco, ladrillo.
// Código puro (sin React Native) para poder probarlo en Node. Los contrastes se vigilan en tokens.test.ts.

export const colors = {
  // Marca
  primary: "#1E6B3C", // verde obra: marca, botones, pestaña activa, geocerca
  primaryDark: "#14502B", // pulsado
  primaryTint: "#E3F1E7",
  onPrimary: "#FFFFFF",
  // Atención: avisos y obras que se encima (el chaleco reflectante)
  accent: "#F5B700",
  accentDark: "#D9A000", // pulsado
  accentTint: "#FFF4CC",
  accentText: "#6B4E00",
  // Salida, errores y acciones que borran
  danger: "#B6341C",
  dangerDark: "#8F2915", // pulsado
  dangerTint: "#FBE6E1",
  // Neutros con un matiz verde
  text: "#17231C", // tinta
  muted: "#5B6A60", // tinta suave
  paper: "#F5F4EF", // fondo de pantallas
  card: "#FFFFFF",
  line: "#E3E1D8", // separadores y bordes de tarjetas
  edge: "#6F7E74", // borde de campos y chips: más fuerte que una línea para que se vea al sol
  // Sistema
  gps: "#2F6FE4", // el punto azul de la ubicación es el del sistema
  scrim: "rgba(23, 35, 28, 0.5)",
} as const;

export type ColorName = keyof typeof colors;

// Escala de 4 px.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

// Tamaño mínimo de un toque (dp). Android recomienda 48.
export const TOUCH_MIN = 48;

// La letra respeta el tamaño que la persona fije en Android, hasta este múltiplo: las pantallas deben aguantarlo.
export const MAX_FONT_SCALE = 1.3;

export type FaceName = "display" | "displayMedium" | "text" | "textMedium" | "textSemi" | "textBold";

export interface TypeSpec {
  face: FaceName;
  size: number;
  lineHeight: number;
  letterSpacing?: number;
  uppercase?: boolean;
  tabularNumbers?: boolean;
}

// Barlow Condensed para títulos y números grandes; Public Sans para todo el texto. Los textos de lectura no bajan de 13;
// solo las etiquetas cortas de grupo en mayúsculas llegan a 12.
export const typeScale = {
  timer: { face: "display", size: 64, lineHeight: 68, tabularNumbers: true },
  hero: { face: "display", size: 40, lineHeight: 44 },
  title: { face: "display", size: 34, lineHeight: 38 },
  heading: { face: "display", size: 22, lineHeight: 26 },
  subheading: { face: "displayMedium", size: 18, lineHeight: 22 },
  body: { face: "text", size: 16, lineHeight: 23 },
  bodyStrong: { face: "textSemi", size: 16, lineHeight: 23 },
  small: { face: "text", size: 14, lineHeight: 20 },
  smallStrong: { face: "textSemi", size: 14, lineHeight: 20 },
  caption: { face: "text", size: 13, lineHeight: 18 },
  captionStrong: { face: "textBold", size: 13, lineHeight: 18 },
  label: { face: "textBold", size: 12, lineHeight: 16, letterSpacing: 0.8, uppercase: true },
  button: { face: "textBold", size: 16, lineHeight: 20 },
} as const satisfies Record<string, TypeSpec>;

export type TextVariant = keyof typeof typeScale;

// Sombras: tarjetas flotantes (hoja inferior, botones sobre el mapa).
export const shadows = {
  float: { shadowColor: "#000000", shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  sheet: { shadowColor: "#000000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 12 },
} as const;
