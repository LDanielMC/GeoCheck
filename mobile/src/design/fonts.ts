import { Platform } from "react-native";
import { FONT_FACES } from "./fontFaces";
import type { FaceName } from "./tokens";

// Nombre de familia de una cara de la tipografía en la plataforma actual.
export function fontFamily(face: FaceName): string {
  return Platform.OS === "ios" ? FONT_FACES[face].ios : FONT_FACES[face].android;
}
