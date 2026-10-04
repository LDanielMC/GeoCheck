import axios from "axios";

// Mensaje para mostrar al usuario a partir de cualquier error de una petición.
export function errorMessage(error: unknown, fallback = "Ocurrió un error inesperado"): string {
  if (axios.isAxiosError(error)) {
    const serverMessage = error.response?.data?.error;
    if (typeof serverMessage === "string") return serverMessage;
    if (!error.response) return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
    return fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// 401 = el servidor rechazó la sesión (token vencido, usuario eliminado).
export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
