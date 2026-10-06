// Spike de geofencing — hora de un cruce capturado después de cruzar. Código puro, para probarlo en Node.

// Interpreta "HH:MM" o "HH:MM:SS" (24 h, hora local) como la última vez que el reloj marcó esa hora antes de
// `now`. Si la hora escrita aún no ha llegado hoy se entiende de ayer: pasa en una prueba nocturna que se
// captura a la mañana siguiente. Devuelve null si el texto no es una hora válida.
export function parseClock(text: string, now: Date): Date | null {
  const match = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  const at = new Date(now);
  at.setHours(hours, minutes, seconds, 0);
  // Un minuto de tolerancia: capturar "17:36" a las 17:35:50 sigue siendo "ahora", no ayer.
  if (at.getTime() > now.getTime() + 60_000) at.setDate(at.getDate() - 1);
  return at;
}

export const minutesAgo = (minutes: number, now: Date): Date => new Date(now.getTime() - minutes * 60_000);
