// TODOS los textos de la interfaz, en español, en un solo lugar. Las pantallas importan `texts` y no escriben frases
// propias: así, cuando llegue el inglés (US-23), se añade un archivo hermano de este y no se toca ninguna pantalla.
//
// Reglas:
// - Un texto con datos usa {nombre}: texts.x.y se pasa por format() ("Vence el {date}").
// - Un texto que cambia con la cantidad usa { one, other } y plural() (el inglés y el español no cuentan igual).
// - Quien lea la pantalla es una persona de obra: frases cortas, sin tecnicismos, con lo que pasó y qué hacer.
//
// Las pantallas se migran aquí al rediseñarse (rebanada D); lo que aún no está migrado sigue en su pantalla.

export const es = {
  common: {
    cancel: "Cancelar",
    save: "Guardar",
    back: "Volver",
    retry: "Reintentar",
    close: "Cerrar",
    confirm: "Confirmar",
    add: "Agregar",
    edit: "Editar",
    search: "Buscar",
    loading: "Cargando…",
    offlineBanner: "Sin conexión con el servidor. Mostrando tu última sesión.",
    unexpectedError: "Ocurrió un error inesperado",
    connectionError: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  },

  roles: {
    ADMIN: "Administrador",
    SUPERVISOR: "Supervisor",
    EMPLOYEE: "Empleado",
    BOOKKEEPER: "Contador",
  },

  // Pestañas de la barra inferior (D1).
  tabs: {
    home: "Inicio",
    projects: "Obras",
    records: "Registros",
    team: "Equipo",
    more: "Más",
  },
} as const;

type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> };

// Misma forma que `es` pero con textos libres: cada idioma nuevo debe cumplirla.
export type Texts = Widen<typeof es>;
