// Matriz de pruebas del spike (ver plan). Cada entrada del log queda etiquetada con el escenario activo.

export interface Scenario {
  id: string;
  title: string;
  how: string;
}

export const SCENARIOS: Scenario[] = [
  { id: "1", title: "App abierta", how: "Deja la app abierta en primer plano y cruza la frontera. Es la línea base." },
  { id: "2", title: "Segundo plano, pantalla bloqueada", how: "Sal de la app con Inicio, bloquea la pantalla y cruza la frontera." },
  { id: "3", title: "App cerrada (deslizada de recientes)", how: "Desliza la app fuera de recientes. NO la abras antes de cruzar. Es el caso crítico." },
  { id: "4", title: "Tras reiniciar el teléfono", how: "Registra la geocerca, reinicia el teléfono, NO abras la app y cruza la frontera." },
  { id: "5", title: "Ahorro de batería activado", how: "Activa el ahorro de batería del sistema y repite entradas y salidas." },
  { id: "6", title: "Noche quieto (Doze)", how: "Deja el teléfono quieto toda la noche dentro del radio, cerca del borde si puedes. No marques nada." },
  { id: "7", title: "Quieto cerca del borde 1–2 h", how: "Quédate quieto dentro del radio, cerca del borde, 1–2 h. No marques nada: cuenta los eventos falsos." },
  { id: "8", title: "Permisos reducidos", how: "Quita 'Permitir todo el tiempo' o deja ubicación aproximada y observa qué falla." },
  { id: "9", title: "Batería: con y sin exclusión", how: "Compara con la app excluida de la optimización de batería (y con inicio automático) frente a sin excluir." },
];

export const BATTERY_PROFILES = [
  { id: "default", title: "Ajustes por defecto" },
  { id: "unrestricted", title: "Sin restricciones + inicio automático" },
];
