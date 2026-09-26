import axios from "axios";
import Constants from "expo-constants";
import { getToken } from "./tokenStorage";

// "localhost" apunta al propio teléfono, no a la PC que corre el backend.
// En desarrollo derivamos la IP de la LAN desde la misma URL que usó
// Expo Go para cargar el bundle (funciona en cualquier red sin hardcodear IPs).
function resolveDevBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : "http://localhost:3000";
}

// En producción, cambiar por la URL real del backend desplegado (Railway/Render/Fly.io)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || resolveDevBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
