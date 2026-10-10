import type { FaceName } from "./tokens";

// Las tipografías viajan dentro de la app (plugin expo-font de app.json): disponibles desde el primer segundo, sin
// descargar nada. Android usa el nombre del archivo como familia; iOS, el nombre PostScript que trae el archivo.
// Estos datos y la lista `fonts` del plugin en app.json deben coincidir: lo comprueba tokens.test.ts.
export const FONT_FACES: Record<FaceName, { android: string; ios: string; file: string }> = {
  display: {
    android: "BarlowCondensed_700Bold",
    ios: "BarlowCondensed-Bold",
    file: "node_modules/@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf",
  },
  displayMedium: {
    android: "BarlowCondensed_600SemiBold",
    ios: "BarlowCondensed-SemiBold",
    file: "node_modules/@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf",
  },
  text: {
    android: "PublicSans_400Regular",
    ios: "PublicSans-Regular",
    file: "node_modules/@expo-google-fonts/public-sans/400Regular/PublicSans_400Regular.ttf",
  },
  textMedium: {
    android: "PublicSans_500Medium",
    ios: "PublicSans-Medium",
    file: "node_modules/@expo-google-fonts/public-sans/500Medium/PublicSans_500Medium.ttf",
  },
  textSemi: {
    android: "PublicSans_600SemiBold",
    ios: "PublicSans-SemiBold",
    file: "node_modules/@expo-google-fonts/public-sans/600SemiBold/PublicSans_600SemiBold.ttf",
  },
  textBold: {
    android: "PublicSans_700Bold",
    ios: "PublicSans-Bold",
    file: "node_modules/@expo-google-fonts/public-sans/700Bold/PublicSans_700Bold.ttf",
  },
};
