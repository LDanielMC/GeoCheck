import { api } from "./api";
import { setToken, clearToken } from "./tokenStorage";

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  await setToken(data.token);
  return data.user;
}

export async function logout() {
  await clearToken();
}
