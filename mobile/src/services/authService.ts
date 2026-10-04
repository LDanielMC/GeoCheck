import { api } from "./api";
import type { Session, SessionUser } from "../types";

// Estas funciones solo hablan con el servidor; guardar la sesión es trabajo de AuthContext.signIn.

export async function login(email: string, password: string): Promise<Session> {
  const { data } = await api.post<Session>("/auth/login", { email, password });
  return data;
}

export async function registerOrganization(input: {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}): Promise<Session> {
  const { data } = await api.post<Session>("/auth/register-organization", input);
  return data;
}

export async function joinWithCode(input: {
  code: string;
  name: string;
  email: string;
  password: string;
}): Promise<Session> {
  const { data } = await api.post<Session>("/auth/join", input);
  return data;
}

// Valida el token guardado y trae al usuario con su rol actual.
export async function fetchMe(): Promise<SessionUser> {
  const { data } = await api.get<{ user: SessionUser }>("/auth/me");
  return data.user;
}
