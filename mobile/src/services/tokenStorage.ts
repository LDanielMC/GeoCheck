import * as SecureStore from "expo-secure-store";
import type { SessionUser } from "../types";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

// Último usuario conocido: permite abrir la app sin conexión (RNF-05) sin pedir login de nuevo.
export async function getCachedUser(): Promise<SessionUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export const setCachedUser = (user: SessionUser) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

export async function saveSession(token: string, user: SessionUser) {
  await Promise.all([setToken(token), setCachedUser(user)]);
}

export async function clearSession() {
  await Promise.all([clearToken(), SecureStore.deleteItemAsync(USER_KEY)]);
}
