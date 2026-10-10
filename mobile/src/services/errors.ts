import axios from "axios";
import { texts } from "../texts";

// Mensaje para mostrar al usuario a partir de cualquier error de una petición.
export function errorMessage(error: unknown, fallback: string = texts.common.unexpectedError): string {
  if (axios.isAxiosError(error)) {
    const serverMessage = error.response?.data?.error;
    if (typeof serverMessage === "string") return serverMessage;
    if (!error.response) return texts.common.connectionError;
    return fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// 401 = el servidor rechazó la sesión (token vencido, usuario eliminado).
export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
