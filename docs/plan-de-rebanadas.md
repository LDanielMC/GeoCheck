# Plan de rebanadas

Última actualización: 2026-10-10 · Producto de referencia: Supercrew (antes ConstructionClock), ver
[Analisis_Requisitos_ConstructionClock.md](../Analisis_Requisitos_ConstructionClock.md) · Historias: [User_Stories.md](../User_Stories.md)

Este documento fija el orden y el alcance. **Nada entra al plan sin aprobación**: lo decidido está en «Decidido»; lo que
propongo y falta confirmar va marcado como *propuesto* o en «Por confirmar». Cada rebanada se detalla y se aprueba al empezarla.

## Orden

| # | Rebanada | Estado | Historias |
|---|---|---|---|
| 0 | Base multi-tenant, autenticación con roles, invitaciones | Hecha | US-12 |
| — | Spike de geofencing | **Cerrado el 2026-10-10: viable** ([resultado](spike-resultado.md)); el escenario 3 pasó | RNF-01, RNF-03 |
| 1 | Proyectos: crear, ver, editar y archivar; ubicación con GPS, coordenadas, mapa o dirección | Implementada, con autocompletado de Google y punto azul; falta probar el mapa y la búsqueda en el teléfono (development build con la clave de Google) | US-11 |
| D | **Diseño** (identidad visual, navegación por pestañas y rediseño de las pantallas que ya existen) | **Aprobada el 2026-10-10**; en curso, orden D0 → D6 (ver «Rebanada D») | — |
| 2 | Fichaje automático y manual, **con la cola de fichajes pendientes sin conexión** | Siguiente, después de la D | US-01, US-02, US-03, US-21; US-04 (*propuesto*: totales simples) |
| W | **Panel web mínimo** | Alcance por aprobar antes de empezar | US-09, US-13, US-14, US-15, US-24 |
| 3 | Batería (la cola sin conexión pasó a la rebanada 2) | | US-22 |
| 5 | Supervisor | | US-07, US-08 |

Orden decidido: **D → 2 → W → 3 → 5**. La antigua rebanada 4 (reportes y exportación) desaparece: se hace en W.

## Decidido (2026-10-08)

- **Ubicación solo en los fichajes (RF-15).** Fuera del MVP: historial de rutas y ubicación en vivo continua. Consecuencia
  para US-08: en lugar de la posición de cada empleado, muestra quién tiene un fichaje abierto y en qué proyecto.
- **Mapa en el móvil:** `react-native-maps` (Google Maps en Android, Apple Maps en iOS) con el pin y el círculo del radio.
  Las obras se dan de alta sobre todo desde el teléfono; hacerlo desde la computadora sería un extra.
- **Búsqueda por dirección:** el geocodificador del teléfono (`expo-location`). Si con direcciones reales de EE. UU. no da
  buenos resultados, se pasa a Google desde el backend (solo cambia `searchAddress`). La cuenta de Google la crea el usuario a
  nombre de su agencia. El mapa de Android necesita su clave también para probar: en el Expo Go del teléfono de pruebas salió
  en blanco, así que se prueba con un development build que la lleve (pasos en el README). La clave llega por la variable
  `GOOGLE_MAPS_ANDROID_API_KEY` de EAS, nunca en el repositorio.
- **Panel web mínimo (W)** con el orden 2 → W → 3 → 5. Los reportes y la exportación (US-13, US-14, US-15) van en la web.
- **Tiempo de traslado (US-24), MVP:** se calcula a partir de la salida de una obra y la entrada a la siguiente.
- **Editar horas con motivo (US-09), MVP:** va en el panel web.
- **Reglas de nómina configurables** por el administrador de cada organización, con valores por defecto razonables; ninguna
  regla legal va fija en el código (el primer cliente está en Oregon).
- **Pegar coordenadas:** queda como está; no se aceptan enlaces ni grados y minutos.
- **Batería:** se queda como «probable»; no se mide más.
- **Recompilación del APK:** `shouldPlaySound: true` en `labNotifications.ts` y los parches de `expo` (57.0.27),
  `expo-constants` (57.0.21) y `expo-notifications` (57.0.22) quedaron aplicados en el código el 2026-10-08, al preparar el
  build con la clave de Google Maps. La vibración solo se nota en el APK `spike`; al instalarlo, el usuario revisa en el
  teléfono el canal de notificaciones (vibración, no molestar).

## Decidido (2026-10-10)

- **Spike cerrado: viable.** Escenario 3 pasado (latencias de 2 min 25 s en salida y 42 s en entrada), la detección funciona sin
  datos móviles, y la vibración con la app cerrada funcionó. Lecciones: falsos positivos con mala precisión y el borde no debe
  quedar donde la gente pasa mucho tiempo. No se agrega nada más al laboratorio.
- **Cola de fichajes pendientes sin conexión: adelantada a la rebanada 2** (antes en la 3). En obras sin señal no se deben perder
  horas. La rebanada 3 queda solo con la batería (US-22).
- **Corregir días con motivo (US-09), también en el móvil**, no solo en el panel web, porque el dueño usa sobre todo el teléfono.
  Se detalla al empezar la rebanada 2.
- **Notificaciones de la app real:** el fichaje automático avisa con vibración y sonido por defecto, y cada persona lo cambia en
  «Más». En Android el sonido y la vibración de un canal no se cambian desde la app una vez creado: se necesita un canal por opción.
  Se detalla en la rebanada 2.

## Rebanada D: diseño (aprobada el 2026-10-10)

Propuesta y maqueta: [vista previa](https://claude.ai/artifact/BZL1RtYGwmVF2enJ6NfJFP). Identidad: verde obra `#1E6B3C`, amarillo
chaleco `#F5B700` (avisos), ladrillo `#B6341C` (salida y errores), papel `#F5F4EF`, tinta `#17231C`; Barlow Condensed (títulos
y números) y Public Sans (texto); íconos de contorno de trazo único; símbolo propio de la marca (pin, anillo punteado, palomita).
Navegación por pestañas inferiores según el rol: administrador y supervisor, Inicio · Obras · Registros · Equipo · Más;
empleado, Inicio · Obras · Registros · Más; contador, Obras · Registros · Más. Barra propia sobre la navegación por estado actual.

**Orden:** D0 base (colores, letras, íconos, piezas y archivo de textos) → D1 estructura (pestañas por rol, «atrás», Más) → D2 acceso
(login, registro, unirse) → D3 editor de obra con mapa (y la columna `address`) → D4 lista de Obras → D5 Inicio y Equipo → D6 ícono y
pantalla de arranque, accesibilidad, documentación y pruebas.

**Avance:** D0 hecha (2026-10-10, pendiente de ver en el teléfono con el nuevo development build).

**Ajustes aprobados:**

- **Inicio centrado en el estado, no en el botón.** La app ficha sola, así que el Inicio muestra en grande el estado actual
  («Dentro de [obra] desde 7:02 · automático» o «Fuera de obra») y el botón manual de registrar entrada o salida queda como
  respaldo, más discreto. En D se diseña ese estado; el fichaje real llega en la rebanada 2.
- **Textos centralizados desde ahora:** todos los textos de la interfaz en un solo archivo en español, para traducir (US-23) sin
  tocar cada pantalla. El cambio de idioma no se implementa todavía.
- **Dependencias nuevas** (`react-native-svg`, íconos, `expo-font` con las dos tipografías, deslizador): se juntan en el próximo
  development build.
- **Dirección guardada en cada obra** (columna `address` opcional; las obras viejas muestran coordenadas).
- **Miniatura del mapa en las tarjetas** con `react-native-maps` en modo ligero (lite mode, solo Android) y, si va lento, un recuadro
  con ícono. Sin la API de imágenes estáticas de Google.
- **Fuera de D:** el contenido de Registros, el fichaje real, el modo oscuro, el cambio de idioma, presupuestos, tareas, fotos y
  notas, y deslizar tarjetas para acciones.

## Estado actual de los datos (verificado en el backend)

Lo que existe hoy limita lo que las rebanadas 2 y W tienen que añadir:

- `TimeEntry`: usuario, proyecto, `type` (AUTO, MANUAL o DELEGATED) **para toda la entrada**, `clockIn`, `clockOut` (nulo =
  abierta), `editedById` y `editedAt` (solo la última edición). Un índice único parcial impide dos entradas abiertas por usuario.
- **No guarda:** precisión ni antigüedad de la ubicación del evento, el origen de cada extremo por separado, el motivo de una
  edición, el historial de ediciones ni las pausas de comida.
- **La API solo escribe:** fichar entrada, salida, entrada delegada y editar horas (`PATCH /time-entries/:id`, ADMIN y
  SUPERVISOR, **sin motivo**). No hay ningún endpoint para leer entradas ni para listar las personas de la organización.
- `Organization` solo tiene nombre: no hay ajustes (zona horaria, ciclo de pago, reglas de nómina).

## Reglas de nómina configurables: dónde entran

Son ajustes de la organización que edita su ADMIN. **No se implementan todavía.**

- **Configuración:** rebanada **W**, pantalla de ajustes de la organización (US-14). Requiere una tabla de ajustes nueva.
- **Cálculo:** rebanada **W**, en el backend, como una función pura con tests (entradas + ajustes → horas regulares, extra,
  comida y traslado). La usan los reportes (US-13) y la exportación (US-15). Si se confirma el punto 5 de «Por confirmar»,
  también la pantalla «Mis horas» del móvil (US-04).
- **Rebanada 2:** solo debe guardar los datos exactos (ver la sección siguiente). La excepción es el **registro manual de
  comida**, que necesita los botones de inicio y fin de pausa en el móvil (US-05, hoy 🟡): ver «Por confirmar», punto 1.

| Ajuste | Valores | Por defecto |
|---|---|---|
| Inicio de la semana laboral | Día de la semana | Domingo |
| Horas extra: umbral semanal | Horas | 40 |
| Horas extra: umbral diario | Horas, opcional | Desactivado |
| Comida | No descontar · descuento automático (minutos y duración mínima del turno) · registro manual con botón de inicio y fin | Descuento automático: 30 min en turnos de 6 h o más |
| Ciclo de pago (US-14) | Semanal, quincenal o mensual, con día de inicio | Semanal (*propuesto*) |
| Zona horaria de la organización (*propuesto*) | Zona horaria | La del teléfono del administrador al crear la organización |

El inicio de la semana laboral (que fija las horas extra) es independiente del día de inicio del ciclo de pago.

## US-24 (traslado) y el modelo de datos de la rebanada 2

El traslado **se deriva, no se rastrea** (no hay seguimiento continuo): es el tiempo entre la salida de una obra y la entrada a
la siguiente. Solo cuenta entre dos obras: el trayecto de la casa a la primera o de la última a la casa no es traslado. Lo
calcula W; la rebanada 2 tiene que dejar los datos listos. Se detalla y se aprueba su modelo al empezarla; mientras tanto:

- Cada entrada es una estancia en **un** proyecto, con su hora exacta de entrada y de salida. No se fusionan ni se redondean.
- El origen (geocerca, manual, delegado, **conciliado** al abrir la app) se guarda **por extremo**: una entrada puede empezar sola
  y cerrarse a mano, y una salida escrita horas después no es el cruce real, así que el traslado que la use es menos fiable.
- Cada evento guarda la precisión y la antigüedad de su ubicación (en el spike hubo fixes de hasta 89 s).
- Un extremo **estimado** por la conciliación se marca como tal.
- El filtro contra rebotes protege el traslado: un rebote de 5 s en el borde crearía un traslado falso de 5 s y dos estancias.
- Android limita a 100 geocercas por app: con muchas obras se registran solo las activas o cercanas.
- *Propuesto:* las horas no se guardan precalculadas; se calculan al leer con las reglas vigentes. Si hay que congelar los periodos ya
  cerrados o exportados, se decide al definir W.
- Hace falta poder **leer** entradas: la rebanada 2 necesita la entrada abierta del usuario (conciliar al abrir la app) y W, lecturas con filtros.

## Editar horas con motivo (US-09) en W

- Hoy `PATCH /time-entries/:id` edita sin motivo y solo recuerda la última edición. Se endurece: motivo obligatorio y un
  historial (quién, cuándo, motivo, valores anterior y nuevo). **Decidido el 2026-10-10: la corrección con motivo también va en el
  móvil**, no solo en la web; el endurecimiento del servidor y la pantalla móvil se detallan al empezar la rebanada 2 (la lectura de
  fichajes que necesita la pantalla Registros), y la web la reutiliza en W. Hasta entonces la app móvil no expone edición.
- Al corregir una entrada se recalculan los totales y el traslado (US-24).

## Borrador del alcance de W (no aprobado)

El alcance exacto se muestra para aprobarlo **antes** de empezar W, cuando termine la rebanada 2. Este es solo el borrador.

**Incluye (sale de lo decidido):**

- Inicio de sesión en la web con la misma API. ADMIN: todo. SUPERVISOR: corregir horas (US-09).
- Horas del periodo por empleado y proyecto, con regulares, extra, comida y traslado (US-13, US-24).
- Corregir entradas con motivo e historial (US-09).
- Ajustes de la organización: ciclo de pago y reglas de nómina (US-14).
- Exportación a XLSX y PDF respetando los filtros (US-15).
- Backend nuevo: lectura de entradas con filtros, listado de personas, ajustes, historial de ediciones, cálculo y exportación.

**Extras que decides tú (no incluidos):** crear y editar proyectos desde la web con mapa; invitaciones y personas en la web;
acceso de solo lectura para el contador (US-20, 🟡). También quedan por decidir, con costos verificados en documentación
oficial, la tecnología del panel y dónde se aloja (la app es gratuita).

## Por confirmar

**Antes de la rebanada 2 (afectan lo que se construye en el móvil):**

1. **Comida con registro manual:** necesita los botones de US-05 y guardar las pausas. ¿Se sube US-05 a MVP (entra con el
   fichaje) o esa opción no se ofrece hasta la Fase 2?
2. **US-04 «Mis horas» (móvil):** *propuesto*: totales simples del día y la semana en la rebanada 2, y con las reglas de nómina
   cuando exista W.

**Antes de W:**

3. **Traslado:** máximo entre una salida y la siguiente entrada para contarlo (*propuesto*: 2 h, configurable); a qué proyecto se
   asigna (*propuesto*: al de destino); qué pasa si se sale y se vuelve al **mismo** proyecto (RF-07 menciona viajes a comprar
   materiales).
4. **Comida automática y horas extra:** qué es un «turno» (*propuesto*: lo trabajado por empleado y día, descontando una sola vez) y
   cómo se combinan los umbrales diario y semanal sin contar dos veces las mismas horas extra.
5. **US-13 «por cuadrilla»:** las cuadrillas son US-17 (Fase 2). *Propuesto*: reportes por empleado y proyecto, salvo que subas US-17.
6. **Zona horaria:** hace falta para delimitar días y semanas; la propuesta está en la tabla de ajustes.

## Ideas para revisar después (2026-10-08, no aprobadas ni planificadas)

Salen de revisar la app de referencia. Ninguna se implementa sin aprobarla antes.

- **Horario de la obra:** que el fichaje automático solo ocurra dentro de un horario configurado por obra. Ayudaría contra los
  falsos positivos de la geocerca (por ejemplo, pasar por la obra fuera de horario). Habría que decidir qué pasa con un fichaje
  manual fuera de horario y cómo se combina con el horario de la organización.
- **Evitar el registro automático por obra:** un ajuste por obra para que ese proyecto solo admita fichaje manual, aunque el
  empleado use el método automático.

## Fuera del MVP

Historial de rutas y ubicación en vivo continua (se mantiene RF-15) · integraciones con QuickBooks, Xero y Payworks (US-18, US-19) ·
lo 🟡 de las historias que no se haya subido explícitamente.
