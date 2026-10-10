// Iniciales para el avatar: primera letra de las dos primeras palabras ("Luis Daniel Moctezum" → "LD").
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]);
  return letters.length > 0 ? letters.join("").toLocaleUpperCase("es") : "?";
}
