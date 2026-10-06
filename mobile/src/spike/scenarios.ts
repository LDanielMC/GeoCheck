// Matriz de pruebas del spike (ver docs/spike-geofencing.md). Cada sesión queda etiquetada con su escenario.
// Es texto puro (sin React Native): los números dependen del radio y se rellenan con renderScenario.

export interface Scenario {
  id: string;
  title: string;
  start: string; // dónde empezar
  phone: string; // cómo debe estar el teléfono durante la prueba
  steps: string[]; // flujo en orden; admite {out} {in} {near} {margin}
  mark: string; // cómo marcar los cruces
  repeat: string;
}

// Antes de cualquier escenario con cruces: sin saber dónde está el borde no se puede medir nada.
export const RECON_STEP =
  "Reconocimiento previo: con el panel en vivo camina hasta el borde y fíjate en un punto de referencia EN el borde (poste, árbol, esquina) y otro {margin} m más afuera.";

const NOTIFICATION_MARK = "Notificación fija «Salí» / «Entré» (sin abrir la app). Si desaparece, anota la hora en el reloj y usa «Agregar cruce con hora».";

export const SCENARIOS: Scenario[] = [
  {
    id: "1",
    title: "App abierta (línea base)",
    start: "DENTRO, cerca del centro.",
    phone: "App abierta, pantalla encendida, panel en vivo ACTIVO.",
    steps: [
      "Registra la geocerca estando dentro.",
      "Camina en línea recta hacia afuera hasta ≥ {out} m del centro (el panel te dice cuánto falta).",
      "Toca «Estoy SALIENDO» en el instante en que el panel marque «En el borde».",
      "Espera la vibración «SALIDA detectada» (máx. 10 min) sin tocar nada.",
      "Regresa hasta ≤ {in} m del centro; toca «Estoy ENTRANDO» al pisar el borde y espera la vibración «ENTRADA detectada».",
    ],
    mark: "Botones de la app.",
    repeat: "5 salidas y 5 entradas.",
  },
  {
    id: "2",
    title: "Segundo plano, pantalla bloqueada",
    start: "DENTRO, cerca del centro.",
    phone: "App en segundo plano y pantalla BLOQUEADA (el panel en vivo se apaga solo al salir de la app).",
    steps: [
      "Registra la geocerca dentro y activa la notificación fija de marcadores.",
      "Sal de la app con el botón Inicio y bloquea la pantalla.",
      "Camina hacia afuera; al pisar el borde pulsa «Salí» en la notificación.",
      "Sigue hasta ≥ {out} m del centro y espera la vibración «SALIDA detectada» (máx. 10 min) sin abrir la app.",
      "Regresa hasta ≤ {in} m; pulsa «Entré» al pisar el borde y espera la vibración «ENTRADA detectada».",
    ],
    mark: NOTIFICATION_MARK,
    repeat: "5 salidas y 5 entradas.",
  },
  {
    id: "3",
    title: "App cerrada (deslizada de Recientes)",
    start: "DENTRO, cerca del centro.",
    phone: "App CERRADA: deslizada fuera de Recientes. No la abras hasta terminar el cruce. Es el caso crítico.",
    steps: [
      "Registra la geocerca dentro y activa la notificación fija de marcadores.",
      "Desliza la app fuera de Recientes y mira si la notificación fija sobrevive (en MIUI puede desaparecer).",
      "Camina hacia afuera hasta ≥ {out} m; pulsa «Salí» al pisar el borde (o anota la hora en el reloj).",
      "Espera la vibración «SALIDA detectada» (máx. 10 min). Repite para la entrada.",
      "Al terminar abre la app; lo que no pudiste marcar, captúralo con «Agregar cruce con hora». Al abrirla Android informa tu estado actual (dentro/fuera) como un evento: es un re-registro, no una detección, y el análisis lo aparta.",
    ],
    mark: NOTIFICATION_MARK,
    repeat: "5 salidas y 5 entradas.",
  },
  {
    id: "4",
    title: "Tras reiniciar el teléfono",
    start: "DENTRO, cerca del centro.",
    phone: "Reiniciado. NO abras la app después del reinicio.",
    steps: [
      "Registra la geocerca dentro.",
      "Reinicia el teléfono y espera a que termine de arrancar. No abras la app (la notificación fija se pierde al reiniciar).",
      "Camina hacia afuera hasta ≥ {out} m y anota en el reloj la hora a la que pisas el borde.",
      "Espera la vibración «SALIDA detectada» (máx. 10 min). Si nunca llega, la geocerca no sobrevivió al reinicio.",
      "Abre la app y captura la hora con «Agregar cruce con hora». Si no llegó ningún evento mientras tanto, ese es el resultado (la geocerca no sobrevivió); el que llegue justo al abrirla es un re-registro, no una detección.",
    ],
    mark: "Solo captura posterior: anota la hora en el reloj y usa «Agregar cruce con hora».",
    repeat: "3 reinicios.",
  },
  {
    id: "5",
    title: "Ahorro de batería activado",
    start: "DENTRO, cerca del centro.",
    phone: "Ahorro de batería del sistema ACTIVO (el laboratorio lo comprueba).",
    steps: [
      "Activa el ahorro de batería del sistema (Ajustes › Batería).",
      "Registra la geocerca dentro y repite el flujo del escenario 2.",
    ],
    mark: NOTIFICATION_MARK,
    repeat: "5 salidas y 5 entradas.",
  },
  {
    id: "6",
    title: "Noche quieto (Doze)",
    start: "DENTRO, a unos 30 m del borde (donde más rebotes se esperan).",
    phone: "Quieto toda la noche, pantalla bloqueada y SIN cargador (con cargador no entra en Doze).",
    steps: [
      "Pon el centro a ~{near} m de donde dejarás el teléfono: camina hasta ahí, toca «Usar mi ubicación como centro» y regresa.",
      "Registra la geocerca, bloquea la pantalla y deja el teléfono quieto toda la noche.",
      "No marques nada.",
      "Por la mañana abre la app: cada evento real (no el inicial) es una transición falsa.",
    ],
    mark: "Ninguna: lo que cuenta son los eventos sin marcador.",
    repeat: "Al menos 2 noches.",
  },
  {
    id: "7",
    title: "Quieto cerca del borde, 1–2 h",
    start: "DENTRO, a unos 30 m del borde.",
    phone: "Quieto, pantalla bloqueada, app en segundo plano.",
    steps: [
      "Pon el centro a ~{near} m de donde te quedarás: camina hasta ahí, toca «Usar mi ubicación como centro» y regresa.",
      "Registra la geocerca, bloquea la pantalla y quédate quieto 1–2 h.",
      "No marques nada: cada evento real (no el inicial) es una transición falsa.",
    ],
    mark: "Ninguna: lo que cuenta son los eventos sin marcador.",
    repeat: "3 sesiones.",
  },
  {
    id: "8",
    title: "Permisos reducidos",
    start: "DENTRO, cerca del centro.",
    phone: "Con «Permitir todo el tiempo» retirado o con ubicación aproximada.",
    steps: [
      "Quita «Permitir todo el tiempo» (Ajustes › Permisos) o deja la ubicación aproximada.",
      "Intenta registrar: en este escenario el laboratorio lo permite y anota el resultado o el error.",
      "Camina hasta ≥ {out} m con la app en segundo plano y observa si llega algún evento.",
    ],
    mark: NOTIFICATION_MARK,
    repeat: "3 intentos por cada variante de permiso.",
  },
  {
    id: "9",
    title: "Batería: con y sin exclusión",
    start: "DENTRO, cerca del centro.",
    phone: "Compara dos perfiles de batería con el mismo escenario.",
    steps: [
      "Perfil «Ajustes por defecto»: repite el escenario 2 o 3 y mide la batería (sección 5).",
      "Pide la exclusión (diálogo del sistema), pon «Sin restricciones» en MIUI, activa el inicio automático y elige el perfil «Sin restricciones»: el laboratorio comprueba que Android la reporta.",
      "Repite el mismo escenario con ese perfil y compara.",
    ],
    mark: NOTIFICATION_MARK,
    repeat: "5 salidas y 5 entradas por perfil.",
  },
  {
    id: "10",
    title: "Diagnóstico: ¿la salida espera a que algo pida ubicación?",
    start: "DENTRO, cerca del centro.",
    phone: "Tras cruzar: pantalla BLOQUEADA y SIN tocar el teléfono durante 10 min.",
    steps: [
      "Registra la geocerca dentro. Con el panel en vivo identifica la meta: ≥ {out} m del centro.",
      "Toca «Estoy SALIENDO» al pisar el borde; de inmediato apaga el panel, bloquea la pantalla y camina hasta la meta SIN mirar el teléfono.",
      "Quédate quieto afuera 10 min. Si vibra «SALIDA detectada», termina la repetición.",
      "Si a los 10 min NO vibró: abre la app (el panel pide ubicación) y no toques nada más. El log dirá si el evento llegó justo después.",
    ],
    mark: "Botón «Estoy SALIENDO» (el único toque permitido, al cruzar).",
    repeat: "5 repeticiones.",
  },
];

export const BATTERY_PROFILES = [
  { id: "default", title: "Ajustes por defecto" },
  { id: "unrestricted", title: "Sin restricciones + inicio automático" },
];

export interface RenderedScenario {
  id: string;
  title: string;
  start: string;
  phone: string;
  steps: string[];
  mark: string;
  repeat: string;
  recon: string;
}

// Rellena los números según el radio y el margen con los que se va a probar.
export function renderScenario(scenario: Scenario, radius: number, margin: number): RenderedScenario {
  const fill = (text: string) =>
    text
      .replaceAll("{out}", String(radius + margin))
      .replaceAll("{in}", String(Math.max(radius - margin, 0)))
      .replaceAll("{near}", String(Math.max(radius - 30, 0)))
      .replaceAll("{margin}", String(margin));
  return {
    id: scenario.id,
    title: scenario.title,
    start: fill(scenario.start),
    phone: fill(scenario.phone),
    steps: scenario.steps.map(fill),
    mark: fill(scenario.mark),
    repeat: fill(scenario.repeat),
    recon: fill(RECON_STEP),
  };
}
