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

**US-06** 🟡 Como empleado, quiero ver mi horario asignado, para saber cuándo y dónde debo presentarme.
- Criterios: vista de calendario/lista con proyecto asignado por día. *(RF-29)*

---

## Supervisor / Foreman (capataz de cuadrilla)

**US-07** 🔴 Como supervisor, quiero fichar en nombre de un miembro de mi cuadrilla, para casos donde no tiene el teléfono o falla el GPS.
- Criterios: requiere selección explícita del empleado + confirmación; queda registrado como "delegado por [supervisor]". *(RF-06, RNF-20)*

**US-08** 🔴 Como supervisor, quiero ver en un mapa quién está activo y en qué proyecto en este momento, para tener visibilidad de mi cuadrilla.
- Criterios: mapa en vivo con pines por empleado; refresco cada X segundos. *(RF-10, RF-14)*

**US-09** 🟡 Como supervisor, quiero editar una entrada de tiempo con error, para corregir olvidos de mi equipo.
- Criterios: cualquier edición manual queda con registro de auditoría (quién, cuándo, valor anterior). *(RF-08, RNF-20)*

**US-10** 🟡 Como supervisor, quiero asignar tareas a mi cuadrilla dentro de un proyecto, para organizar el trabajo del día.
- Criterios: lista de tareas por proyecto, asignable a persona o cuadrilla completa. *(RF-19)*

---

## Admin (dueño / encargado de nómina)

**US-11** 🔴 Como admin, quiero crear un proyecto definiendo su ubicación y radio de geofence, para que el sistema empiece a rastrear horas ahí.
- Criterios: selección de ubicación en mapa + radio ajustable en metros; validación de radio mínimo/máximo razonable. *(RF-01, RF-02)*

**US-12** 🔴 Como admin, quiero invitar empleados a mi organización mediante un link o código, para que se unan sin fricción.
- Criterios: link/código con expiración configurable; el empleado se auto-asigna rol "employee" al aceptar. *(RF-31, RF-32)*

**US-13** 🔴 Como admin, quiero ver el total de horas por empleado, cuadrilla y proyecto en un rango de fechas, para preparar la nómina.
- Criterios: filtros por empleado/cuadrilla/proyecto/fecha; totales con y sin horas extra. *(RF-11, RF-13)*

**US-14** 🔴 Como admin, quiero configurar el ciclo de pago de mi empresa, para que los reportes se agrupen correctamente.
- Criterios: semanal / quincenal / mensual, con día de inicio configurable. *(RF-23)*

**US-15** 🔴 Como admin, quiero exportar el reporte de horas en XLSX o PDF, para pasarlo a mi sistema de nómina actual.
- Criterios: exportación respeta filtros aplicados; incluye desglose por empleado y totales. *(RF-24)*

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

El MVP cubre: creación de proyectos con geofence (US-11), clock-in/out automático y manual (US-01 a US-03), delegación por supervisor (US-07), mapa en vivo (US-08), horas por empleado/proyecto (US-04, US-13), ciclo de pago y exportación (US-14, US-15), invitaciones (US-12), modo offline y batería (US-21, US-22).

Todo lo 🟡 (pausas con descuento, presupuesto de horas, cuadrillas, edición con auditoría, tareas, idiomas) queda para Fase 2. Lo ⚪ (QuickBooks/Xero, Payworks) sigue descartado según lo ya decidido.
