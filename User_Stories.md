# User Stories — App de Control de Horas para Construcción
### Derivadas del documento de Análisis de Requisitos (RF/RNF)

Formato: `Como [rol], quiero [acción], para [beneficio]` + criterios de aceptación + RF relacionado.
Prioridad: 🔴 MVP · 🟡 Fase 2 · ⚪ No prioritario por ahora (según decisiones ya tomadas: RF-25, RF-26 fuera de alcance)

---

## Employee (trabajador de campo)

**US-01** 🔴 Como empleado, quiero que la app registre automáticamente mi entrada al llegar al sitio de trabajo, para no tener que hacer nada manualmente.
- Criterios: detecta entrada al geofence en <60s; funciona con la app en segundo plano; genera notificación local confirmando el clock-in. *(RF-01, RF-03, RF-16)*

**US-02** 🔴 Como empleado, quiero que la app registre automáticamente mi salida al dejar el sitio, para que mis horas queden completas sin intervención mía.
- Criterios: debounce de al menos 2-3 min fuera del radio antes de confirmar salida (evita falsos positivos en el borde). *(RF-04, RNF-03)*

**US-03** 🔴 Como empleado, quiero poder fichar manualmente si el GPS falla o estoy en una zona sin señal, para que mis horas no se pierdan.
- Criterios: opción de clock-in/out manual siempre visible; si no hay internet, se guarda localmente y sincroniza después. *(RF-05, RNF-05)*

**US-04** 🔴 Como empleado, quiero ver mis propias horas trabajadas del día/semana, para verificar que están correctas antes del pago.
- Criterios: vista simple de horas por día, con desglose de pausas. *(RF-11)*

**US-05** 🟡 Como empleado, quiero registrar una pausa de almuerzo, para que se descuente correctamente de mis horas.
- Criterios: botón de "iniciar pausa" / "terminar pausa"; se resta del total automáticamente. *(RF-09, RF-27)*
- Nota (2026-10-08): el modo de comida «registro manual» de las reglas de nómina (US-14) depende de estos botones. Pendiente de decidir si suben a MVP o si esa opción no se ofrece hasta la Fase 2 (docs/plan-de-rebanadas.md).

**US-06** 🟡 Como empleado, quiero ver mi horario asignado, para saber cuándo y dónde debo presentarme.
- Criterios: vista de calendario/lista con proyecto asignado por día. *(RF-29)*

---

## Supervisor / Foreman (capataz de cuadrilla)

**US-07** 🔴 Como supervisor, quiero fichar en nombre de un miembro de mi cuadrilla, para casos donde no tiene el teléfono o falla el GPS.
- Criterios: requiere selección explícita del empleado + confirmación; queda registrado como "delegado por [supervisor]". *(RF-06, RNF-20)*

**US-08** 🔴 Como supervisor, quiero ver en un mapa quién está activo y en qué proyecto en este momento, para tener visibilidad de mi cuadrilla.
- Criterios: el mapa muestra los proyectos y, en cada uno, quién tiene un fichaje abierto y desde qué hora (según los fichajes, no la posición del teléfono); se actualiza al abrir la pantalla y al refrescar. *(RF-10)*
- Decisión (2026-10-08): sin ubicación en vivo continua de cada empleado ni historial de rutas (fuera del MVP); la ubicación solo se toma al fichar (RF-15). Por eso RF-14 («mapa en vivo con la ubicación de cada miembro») queda fuera del MVP.

**US-09** 🔴 Como supervisor, quiero editar una entrada de tiempo con error, para corregir olvidos de mi equipo.
- Criterios: se hace en el panel web (rebanada W), el supervisor y el admin; el motivo es obligatorio; cualquier edición manual queda con registro de auditoría (quién, cuándo, motivo, valor anterior y nuevo); al corregir se recalculan los totales y el traslado. *(RF-08, RNF-20)*
- Decisión (2026-10-08): sube de 🟡 a 🔴. Hoy la API edita sin motivo y solo recuerda la última edición; W lo endurece.

**US-10** 🟡 Como supervisor, quiero asignar tareas a mi cuadrilla dentro de un proyecto, para organizar el trabajo del día.
- Criterios: lista de tareas por proyecto, asignable a persona o cuadrilla completa. *(RF-19)*

---

## Admin (dueño / encargado de nómina)

**US-11** 🔴 Como admin, quiero crear un proyecto definiendo su ubicación y radio de geofence, para que el sistema empiece a rastrear horas ahí.
- Criterios: ubicación con el GPS del teléfono, buscando la dirección, tocando o moviendo el pin en un mapa que muestra el círculo del radio, escribiendo coordenadas o pegando el par «latitud, longitud» que copia Google Maps (sin enlaces ni grados y minutos); radio ajustable en metros, de 100 a 1000 (por defecto 150); editar y archivar. *(RF-01, RF-02, RF-17)*
- Decisión de la rebanada 1: el mínimo de 100 m sale del spike de geofencing (docs/spike-resultado.md).
- Decisión (2026-10-08): el alta se hace sobre todo desde el teléfono (desde la computadora sería un extra). Mapa con react-native-maps; búsqueda por dirección con el geocodificador del teléfono y, si con direcciones reales de EE. UU. da malos resultados, con Google desde el backend. La cuenta y la clave de Google para producción las crea la agencia que publica la app cuando haga falta; en Expo Go funciona sin clave.

**US-12** 🔴 Como admin, quiero invitar empleados a mi organización mediante un link o código, para que se unan sin fricción.
- Criterios: link/código con expiración configurable; el empleado se auto-asigna rol "employee" al aceptar. *(RF-31, RF-32)*

**US-13** 🔴 Como admin, quiero ver el total de horas por empleado, cuadrilla y proyecto en un rango de fechas, para preparar la nómina.
- Criterios: se hace en el panel web (rebanada W); filtros por empleado/cuadrilla/proyecto/fecha; totales con y sin horas extra, calculados con las reglas de nómina de la organización (US-14), y el traslado (US-24) aparte. *(RF-11, RF-13)*
- Nota: «cuadrilla» depende de US-17 (🟡); pendiente de decidir si el MVP reporta solo por empleado y proyecto (docs/plan-de-rebanadas.md).

**US-14** 🔴 Como admin, quiero configurar el ciclo de pago y las reglas de nómina de mi empresa, para que los reportes se agrupen y se calculen como la empresa paga.
- Criterios: se hace en el panel web (rebanada W); ciclo semanal / quincenal / mensual, con día de inicio configurable. *(RF-23)*
- Reglas de nómina, configurables por cada organización y sin reglas legales fijas en el código *(RF-13, RF-27)*, con estos valores por defecto:
  - Inicio de la semana laboral: domingo.
  - Horas extra: umbral semanal de 40 h; umbral diario opcional, desactivado por defecto.
  - Comida: no descontar, descuento automático (por defecto 30 min en turnos de 6 h o más) o registro manual con botón de inicio y fin (requiere US-05).
- Los cálculos con estas reglas se hacen al generar los reportes (US-13, US-15), no al fichar.

**US-15** 🔴 Como admin, quiero exportar el reporte de horas en XLSX o PDF, para pasarlo a mi sistema de nómina actual.
- Criterios: se hace en el panel web (rebanada W); exportación respeta filtros aplicados; incluye desglose por empleado y totales (regulares, extra, comida y traslado, como en US-13). *(RF-24)*

**US-24** 🔴 Como admin, quiero ver el tiempo de traslado entre obras de cada empleado, para incluirlo en la nómina sin mezclarlo con las horas trabajadas en sitio.
- Criterios: se calcula a partir de la salida de una obra y la entrada a la siguiente del mismo empleado (no hay seguimiento de la ruta: RF-15); solo cuenta entre dos obras, no el trayecto de la casa a la primera ni de la última a la casa; aparece en el reporte (US-13) en una columna aparte de las horas en sitio. *(RF-07)*
- Pendiente de confirmar (docs/plan-de-rebanadas.md): máximo entre la salida y la entrada para contarlo como traslado (propuesto: 2 h, configurable), a qué proyecto se asigna (propuesto: al de destino) y qué pasa si se vuelve al mismo proyecto.
- La rebanada 2 debe guardar horas exactas de entrada y salida, el origen de cada extremo y la precisión de la ubicación, para poder juzgar la fiabilidad de cada traslado. Se calcula en W.
- Historia añadida el 2026-10-08, después de la numeración original.

**US-16** 🟡 Como admin, quiero definir un presupuesto de horas por proyecto y ver el avance real, para controlar el costo de mano de obra.
- Criterios: barra de progreso horas usadas / presupuestadas, con alerta visual si se excede. *(RF-20)*

**US-17** 🟡 Como admin, quiero gestionar cuadrillas agrupando empleados, para organizar equipos por especialidad o proyecto.
- Criterios: crear/editar/eliminar cuadrillas; mover empleados entre cuadrillas. *(RF-12)*

**US-18** ⚪ Como admin, quiero sincronizar mis reportes con QuickBooks o Xero — **fuera de alcance por ahora**, se resuelve con exportación manual (US-15). *(RF-25 — no prioritario)*

**US-19** ⚪ Como admin, quiero integrar Payworks para procesar nómina automáticamente — **fuera de alcance por ahora**. *(RF-26 — no prioritario)*

---

## Bookkeeper (contador)

**US-20** 🟡 Como contador, quiero acceso de solo lectura a los reportes de horas y nómina, para hacer mi trabajo sin poder alterar datos operativos.
- Criterios: rol con permisos read-only sobre timesheets y exportación; sin acceso a edición de proyectos/empleados. *(RNF-10)*

---

## Transversales (todos los roles)

**US-21** 🔴 Como usuario, quiero que la app funcione sin internet y sincronice cuando recupere señal, para no perder registros en sitios sin cobertura.
*(RNF-05)*

**US-22** 🔴 Como usuario, quiero que la app consuma poca batería en segundo plano, para poder usarla toda mi jornada sin quedarme sin carga.
*(RNF-01)*

**US-23** 🟡 Como usuario, quiero usar la app en español o inglés, para trabajar en mi idioma preferido.
*(RNF-13)*

---

## Resumen de priorización para el MVP (🔴)

El MVP cubre: creación de proyectos con geofence, mapa y búsqueda por dirección (US-11), clock-in/out automático y manual (US-01 a US-03), delegación por supervisor (US-07), quién está activo según los fichajes (US-08), horas por empleado/proyecto (US-04, US-13), ciclo de pago, reglas de nómina y exportación (US-14, US-15), corrección de horas con motivo (US-09), tiempo de traslado (US-24), invitaciones (US-12), modo offline y batería (US-21, US-22).

Los reportes, las reglas de nómina, la corrección de horas y la exportación (US-09, US-13, US-14, US-15, US-24) se hacen en un **panel web mínimo** (rebanada W). Orden de las rebanadas pendientes: 2 (fichaje) → W → 3 (offline y batería) → 5 (supervisor); ver [docs/plan-de-rebanadas.md](docs/plan-de-rebanadas.md).

Todo lo 🟡 (pausas con descuento, presupuesto de horas, cuadrillas, tareas, idiomas) queda para Fase 2; la edición con auditoría (US-09) subió a MVP. Pendiente de decidir: si las pausas (US-05) suben a MVP por el modo de comida manual. Fuera del MVP por decisión: historial de rutas y ubicación en vivo continua (RF-15 se mantiene: la ubicación solo se toma al fichar). Lo ⚪ (QuickBooks/Xero, Payworks) sigue descartado según lo ya decidido.
