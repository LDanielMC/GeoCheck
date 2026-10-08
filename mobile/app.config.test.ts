import { readFileSync } from "node:fs";
import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import appConfig from "./app.config";

const KEY = "AIzaSyTestKeyTestKeyTestKeyTestKey00000";
const base = { name: "GeoCheck", slug: "geocheck", plugins: ["expo-secure-store", ["expo-location", { isAndroidBackgroundLocationEnabled: true }]] };
const resolve = (config: object = base) => appConfig({ config } as unknown as ConfigContext);
const pluginNames = (config: { plugins?: unknown[] }) => (config.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

// Entorno de una máquina local: sin clave ni variables de EAS. El setup de vitest activa EXPO_PUBLIC_SPIKE; aquí no.
function localEnvironment(overrides: Record<string, string> = {}) {
  const env: Record<string, string> = {
    GOOGLE_MAPS_ANDROID_API_KEY: "",
    EAS_BUILD: "",
    EAS_BUILD_PLATFORM: "",
    EXPO_PUBLIC_SPIKE: "0",
    ...overrides,
  };
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

afterEach(() => vi.unstubAllEnvs());

describe("clave de Google Maps en la configuración de Expo", () => {
  it("con la clave añade el plugin de react-native-maps y conserva el resto de la configuración", () => {
    localEnvironment({ GOOGLE_MAPS_ANDROID_API_KEY: KEY });
    const config = resolve();
    expect(config.name).toBe("GeoCheck");
    expect(config.plugins).toEqual([...base.plugins, ["react-native-maps", { androidGoogleMapsApiKey: KEY }]]);
  });

  it("ignora los espacios alrededor de la clave", () => {
    localEnvironment({ GOOGLE_MAPS_ANDROID_API_KEY: `  ${KEY}\n` });
    expect(resolve().plugins).toContainEqual(["react-native-maps", { androidGoogleMapsApiKey: KEY }]);
  });

  it("sin clave, en local, no añade el plugin ni falla (el trabajo local y las pruebas no la exigen)", () => {
    localEnvironment();
    const config = resolve();
    expect(pluginNames(config)).toEqual(["expo-secure-store", "expo-location"]);
  });

  it("una clave en blanco cuenta como ausente", () => {
    localEnvironment({ GOOGLE_MAPS_ANDROID_API_KEY: "   " });
    expect(pluginNames(resolve())).not.toContain("react-native-maps");
  });

  it("una configuración sin plugins también funciona", () => {
    localEnvironment({ GOOGLE_MAPS_ANDROID_API_KEY: KEY });
    expect(resolve({ name: "GeoCheck", slug: "geocheck" }).plugins).toEqual([["react-native-maps", { androidGoogleMapsApiKey: KEY }]]);
  });

  it("una compilación de Android en la nube sin la clave falla con un mensaje que dice qué crear", () => {
    localEnvironment({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android" });
    expect(() => resolve()).toThrowError(/GOOGLE_MAPS_ANDROID_API_KEY.*eas env:set/s);
  });

  it("una compilación de Android en la nube con la clave pasa", () => {
    localEnvironment({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android", GOOGLE_MAPS_ANDROID_API_KEY: KEY });
    expect(pluginNames(resolve())).toContain("react-native-maps");
  });

  it("iOS no necesita la clave (usa Apple Maps) y el perfil spike solo monta el laboratorio", () => {
    localEnvironment({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "ios" });
    expect(() => resolve()).not.toThrow();
    localEnvironment({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android", EXPO_PUBLIC_SPIKE: "1" });
    expect(() => resolve()).not.toThrow();
  });

  it("encaja con el app.json real: mismos identificadores y la clave solo se añade, no se escribe en el archivo", () => {
    const appJson = JSON.parse(readFileSync(new URL("./app.json", import.meta.url), "utf8")).expo;
    localEnvironment({ GOOGLE_MAPS_ANDROID_API_KEY: KEY });
    const config = resolve(appJson);
    expect(config.android?.package).toBe("com.cliche.geocheck");
    expect(pluginNames(config)).toEqual([...pluginNames(appJson), "react-native-maps"]);
    expect(JSON.stringify(appJson)).not.toContain("GoogleMaps");
  });
});
