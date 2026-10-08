# Plan de rebanadas

Última actualización: 2026-10-08 · Producto de referencia: Supercrew (antes ConstructionClock), ver
[Analisis_Requisitos_ConstructionClock.md](../Analisis_Requisitos_ConstructionClock.md) · Historias: [User_Stories.md](../User_Stories.md)

Este documento fija el orden y el alcance. **Nada entra al plan sin aprobación**: lo decidido está en «Decidido»; lo que
propongo y falta confirmar va marcado como *propuesto* o en «Por confirmar». Cada rebanada se detalla y se aprueba al empezarla.

## Orden

| # | Rebanada | Estado | Historias |
|---|---|---|---|
| 0 | Base multi-tenant, autenticación con roles, invitaciones | Hecha | US-12 |
| — | Spike de geofencing | Veredicto: viable con condiciones ([resultado](spike-resultado.md)); falta el escenario 3 | RNF-01, RNF-03 |
| 1 | Proyectos: crear, ver, editar y archivar; ubicación con GPS, coordenadas, mapa o dirección | Implementada; falta probarla en Expo Go | US-11 |
| 2 | Fichaje automático y manual | Siguiente | US-01, US-02, US-03; US-04 (*propuesto*: totales simples) |
| W | **Panel web mínimo** | Alcance por aprobar antes de empezar | US-09, US-13, US-14, US-15, US-24 |
| 3 | Sin conexión y batería | | US-21, US-22 |
| 5 | Supervisor | | US-07, US-08 |

Orden decidido: **2 → W → 3 → 5**. La antigua rebanada 4 (reportes y exportación) desaparece: se hace en W.

## Decidido (2026-10-08)

- **Ubicación solo en los fichajes (RF-15).** Fuera del MVP: historial de rutas y ubicación en vivo continua. Consecuencia
  para US-08: en lugar de la posición de cada empleado, muestra quién tiene un fichaje abierto y en qué proyecto.
- **Mapa en el móvil:** `react-native-maps` (Google Maps en Android, Apple Maps en iOS) con el pin y el círculo del radio.
  Las obras se dan de alta sobre todo desde el teléfono; hacerlo desde la computadora sería un extra.
- **Búsqueda por dirección:** el geocodificador del teléfono (`expo-location`). Si con direcciones reales de EE. UU. no da
  buenos resultados, se pasa a Google desde el backend (solo cambia `searchAddress`). La cuenta de Google la crea el usuario a
  nombre de su agencia cuando haga falta la clave de producción; mientras tanto todo funciona en Expo Go.
- **Panel web mínimo (W)** con el orden 2 → W → 3 → 5. Los reportes y la exportación (US-13, US-14, US-15) van en la web.
- **Tiempo de traslado (US-24), MVP:** se calcula a partir de la salida de una obra y la entrada a la siguiente.
- **Editar horas con motivo (US-09), MVP:** va en el panel web.
- **Reglas de nómina configurables** por el administrador de cada organización, con valores por defecto razonables; ninguna
  regla legal va fija en el código (el primer cliente está en Oregon).
- **Pegar coordenadas:** queda como está; no se aceptan enlaces ni grados y minutos.
- **Batería:** se queda como «probable»; no se mide más.
- **Próxima recompilación del APK** (no antes): aplicar `shouldPlaySound: true` en `labNotifications.ts` y actualizar los
  parches de `expo` (57.0.27), `expo-constants` (57.0.21) y `expo-notifications` (57.0.22); ese día el usuario revisa en el
  teléfono el canal de notificaciones (vibración, no molestar).

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

- Hoy `PATCH /time-entries/:id` edita sin motivo y solo recuerda la última edición. En W se endurece: motivo obligatorio y un
  historial (quién, cuándo, motivo, valores anterior y nuevo). Hasta entonces la app móvil no expone edición.
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

## Fuera del MVP

Historial de rutas y ubicación en vivo continua (se mantiene RF-15) · integraciones con QuickBooks, Xero y Payworks (US-18, US-19) ·
lo 🟡 de las historias que no se haya subido explícitamente.
