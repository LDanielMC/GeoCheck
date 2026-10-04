import axios from "axios";
import Constants from "expo-constants";
import { getToken } from "./tokenStorage";

// "localhost" apunta al propio teléfono, no a la PC que corre el backend.
// En desarrollo derivamos la IP de la LAN desde la misma URL que usó
// Expo Go (o el dev client) para cargar el bundle: funciona en cualquier red sin hardcodear IPs.
function resolveDevBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : "http://localhost:3000";
}

// Builds preview/production: EXPO_PUBLIC_API_URL se incrusta al compilar (ver README).
// Si falta, no caemos en localhost en silencio: cada petición falla con un mensaje claro.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? resolveDevBaseUrl() : undefined);

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

let onUnauthorized: (() => void) | undefined;

// AuthContext registra aquí qué hacer cuando el servidor rechaza una sesión activa.
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

api.interceptors.request.use(async (config) => {
  if (!BASE_URL) {
    throw new Error("La app no tiene configurada la URL del servidor (EXPO_PUBLIC_API_URL).");
  }
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 en una petición con sesión iniciada = token vencido o usuario eliminado: volver al login.
    // (Un 401 de login/registro no lleva token, así que no entra aquí.)
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.headers?.Authorization) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);
