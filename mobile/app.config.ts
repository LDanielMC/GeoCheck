import type { ConfigContext, ExpoConfig } from "expo/config";

// Parte de app.json y le añade lo que no debe vivir en el repositorio.
//
// Clave de Google Maps para Android (react-native-maps): sin ella el mapa de un APK propio se ve en blanco. Se lee de
// GOOGLE_MAPS_ANDROID_API_KEY: en EAS viene de `eas env:set` y en local de un .env ignorado por git (README, «Mapa y
// búsqueda de direcciones»). iOS usa Apple Maps y no necesita clave.
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  // En la nube, una compilación de Android sin la clave termina con el mapa en blanco después de esperar el build:
  // mejor cortarla aquí. EAS_BUILD y EAS_BUILD_PLATFORM no existen al evaluar esta configuración en local. El perfil
  // «spike» (EXPO_PUBLIC_SPIKE=1) solo monta el laboratorio y no usa el mapa.
  const isAndroidCloudBuild = process.env.EAS_BUILD === "true" && process.env.EAS_BUILD_PLATFORM === "android";
  if (!androidGoogleMapsApiKey && isAndroidCloudBuild && process.env.EXPO_PUBLIC_SPIKE !== "1") {
    throw new Error(
      "Falta GOOGLE_MAPS_ANDROID_API_KEY: sin ella el mapa de Android sale en blanco. Créala para el entorno de este perfil con " +
        "`eas env:set --name GOOGLE_MAPS_ANDROID_API_KEY --visibility sensitive --environment development --environment preview " +
        "--environment production` (README, «Mapa y búsqueda de direcciones»)."
    );
  }

  return {
    ...config,
    plugins: [...(config.plugins ?? []), ...(androidGoogleMapsApiKey ? [["react-native-maps", { androidGoogleMapsApiKey }] as [string, object]] : [])],
  } as ExpoConfig;
};
