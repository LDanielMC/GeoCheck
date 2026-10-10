import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { fontFamily } from "./fonts";
import { colors, MAX_FONT_SCALE, typeScale, type TextVariant, type TypeSpec } from "./tokens";

export type { TextVariant };

// Texto con la tipografía de GeoCheck. Todo texto de la app pasa por aquí: así la letra y el tamaño salen de la escala.
export function AppText({ variant = "body", color = colors.text, style, ...rest }: TextProps & { variant?: TextVariant; color?: string }) {
  const spec: TypeSpec = typeScale[variant];
  const base: TextStyle = {
    fontFamily: fontFamily(spec.face),
    fontSize: spec.size,
    lineHeight: spec.lineHeight,
    color,
    ...(spec.letterSpacing !== undefined ? { letterSpacing: spec.letterSpacing } : {}),
    ...(spec.uppercase ? { textTransform: "uppercase" as const } : {}),
    // Las cifras de ancho fijo evitan que un cronómetro salte cada segundo.
    ...(spec.tabularNumbers ? { fontVariant: ["tabular-nums" as const] } : {}),
  };
  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[base, style]} {...rest} />;
}
