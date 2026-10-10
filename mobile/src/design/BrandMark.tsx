import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "./tokens";

// Símbolo de GeoCheck: el pin de la obra, el anillo punteado de la geocerca y la palomita del registro.
export function BrandMark({ size = 64, color = colors.primary, checkColor = colors.onPrimary }: { size?: number; color?: string; checkColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image" accessibilityLabel="GeoCheck">
      <Circle cx={32} cy={32} r={28} fill="none" stroke={color} strokeWidth={3.2} strokeDasharray="2 6.6" strokeLinecap="round" />
      <Path d="M32 52S18 41 18 29a14 14 0 1 1 28 0c0 12-14 23-14 23z" fill={color} />
      <Path d="m25.5 29.5 4.8 4.8 8.4-9" fill="none" stroke={checkColor} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
