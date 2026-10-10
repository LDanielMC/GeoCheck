# Resultado del spike de geofencing

Fecha: 2026-10-07, actualizado el 2026-10-10 (escenario 3 y verdad de campo del 9 y 10 de octubre) · Dispositivo: Xiaomi
Redmi Note 10 Pro (Android 13, MIUI 14), ajustes de batería por defecto («Ahorro de batería (recomendado)», sin «Sin
restricciones») · Datos: exportaciones del log del laboratorio, las horas que el usuario tomó con reloj y la verdad de campo
que aportó, y la lectura del código nativo de Expo.

## Veredicto

**Viable.** El usuario **cerró el spike el 2026-10-10**. Lo que podía hundir el enfoque, que el geofencing nativo funcione
con la app cerrada en un Xiaomi, **salió bien**: despierta el proceso muerto, sobrevive a un apagado y encendido del teléfono
sin abrir la app y, el riesgo principal, **también funciona con la app deslizada de Recientes y la pantalla bloqueada**
(escenario 3, 8 oct). La detección **no depende de los datos móviles**. Las condiciones son los requisitos de la rebanada 2
(abajo) y las lecciones de «Escenario 3 y verdad de campo»: filtrar falsos positivos con mala precisión y no dejar el borde
de la geocerca donde la gente pasa mucho tiempo.

Recomendación: la rebanada 2 (fichaje) se diseña con los requisitos de abajo.

## Criterios acordados

| Criterio | Estado | Evidencia |
|---|---|---|
| ≥ 90 % de entradas y salidas detectadas | **Cumple; ninguna pérdida observada** | Escenario 3 (8 oct): 3 de 3 cruces con hora de reloj detectados. 9 y 10 oct: 5 parejas entrada → salida (10 eventos) que corresponden a cruces reales según la rutina del usuario (sin hora de reloj). Antes: 1 de 1 salida real en segundo plano (15:45 del 6 oct). Muestra pequeña |
| Latencia de entrada ≤ 3 min | **Cumple (n=1)** | 42 s en frío: cruzó el borde a las 19:43:17 y la ENTRADA llegó a las 19:43:59 (escenario 3) |
| Latencia de salida ≤ 5 min | **Cumple (n=2 en segundo plano)** | Escenario 3: 2 min 25 s (cruzó a las 19:28:36, SALIDA a las 19:31:01), en frío, app fuera de Recientes y pantalla bloqueada. 6 oct: 0–3 min. 37,5 s con GPS en vivo (S4) |
| ≤ 1 transición falsa por día quieto | **Cumple con reservas** | 1 pareja Exit/Enter falsa en ~20 h en casa el 6 oct (01:47, separadas 4,8 s; el Exit con fix de ±100 m y radio de 100 m). El 9 y 10 oct no se identificó ningún falso. Depende de no poner el borde donde se pasa tiempo |
| Batería ≤ 3 % por jornada | **Probable (decisión del usuario: se deja así, no se medirá más)** | GeoCheck = 3,35 % del *uso total* (cuota de consumo, no % de batería), CPU 4 min 10 s, GPS 15 min 46 s casi todo del panel en vivo. Falta el denominador (cuánto % total se consumió en ese periodo) |
| Funciona con la app cerrada | **Confirmado** | 4 eventos con el proceso muerto (JS recién cargado, ~0,98 s, app en segundo plano) y un cruce real (15:45) |
| Tras reiniciar el teléfono | **Confirmado** | Apagado por batería, encendido sin abrir la app: Expo re-registró la geocerca (el ENTER de las 12:46) y 3 h después se detectó una salida real |
| Con la app deslizada de Recientes | **Confirmado (escenario 3, 8 oct)** | App quitada de Recientes, pantalla bloqueada, MIUI con «Ahorro de batería (recomendado)», radio de 100 m: salida, entrada y otra salida detectadas, en frío y en segundo plano |
| Sin datos móviles | **Confirmado** | 9 y 10 oct: a ratos sin datos móviles, y los eventos se registraron igual. La detección es del sistema (geocercas de Android), no usa la red; el laboratorio no depende del servidor |

## Qué pasó en cada evento fuera del primer plano

| Hora local | Evento | Lectura (verdad de campo) |
|---|---|---|
| 5 oct 20:19:59 | EXIT | Re-registro al instalar el APK nuevo (sin sesión) |
| 6 oct 01:47:02 / 01:47:06 | EXIT + ENTER (4,8 s) | **Falso positivo confirmado**: en casa; el Exit llegó con fix de ±100 m |
| 6 oct 12:46:57 | ENTER | Re-registro tras el arranque del teléfono, no un cruce (fix de hace 89 s) |
| 6 oct 15:45:02 | EXIT | **Detección real**, app cerrada, fix ±4 m; latencia 0–3 min |
| 6 oct 17:19:19 | EXIT | Ambiguo: probando en el borde; llegó 12 s después de abrir la app con el panel encendido |
| 6 oct 19:06:48 / 19:06:52 | ENTER + EXIT (4 s) | Ambiguo: junto al borde; el primero con fix de ±60 m. Puede ser cruce real o rebote |

Las pruebas del 7 oct (S6–S9, en coche, panel en vivo) y las de S4 no miden latencia en segundo plano: los marcadores se
tocaron guiándose por el panel y, salvo en S4, **después** de que el sistema ya había avisado.

## Escenario 3 y verdad de campo (8–10 oct)

**Escenario 3 (8 oct, sesión S10).** App quitada de Recientes, pantalla bloqueada, MIUI con «Ahorro de batería
(recomendado)», radio de 100 m. Horas tomadas con reloj por el usuario (no se capturaron en la app):

| Cruce del borde | Evento | Latencia | Lectura |
|---|---|---|---|
| Salida a las 19:28:36 (llegó a la meta a las 19:29:27) | SALIDA 19:31:01 | **2 min 25 s** | Real, en frío y en segundo plano |
| Regreso a las 19:43:17 | ENTRADA 19:43:59 | **42 s** | Real, en frío |
| Salió ~28 m a las 19:50:02 | SALIDA 19:50:02 | — | **Real**: la casa del usuario queda muy cerca del borde |

La vibración funcionó con la app cerrada (fuerte, como un mensaje de WhatsApp). **No sonó** aunque el sonido del teléfono estaba
activo: es lo esperado, el canal del laboratorio es solo de vibración. Esto cierra el pendiente de la vibración con la app cerrada.

**Verdad de campo del 9 y 10 oct** (la sesión siguió activa; el estacionamiento queda dentro del círculo y la casa justo
afuera, así que cada pareja ENTRADA → SALIDA es ir al coche y volver a casa): 9 oct 12:16/12:20, 14:18/14:22 y 22:06/22:12; 10 oct
07:53/08:35 y 16:27/16:33. Son **cruces reales**, no falsos. Estos días a veces no había datos móviles y los eventos se
registraron igual. Esas horas no se tomaron con reloj: sirven para contar detecciones, no para medir latencia.

**No se toma en cuenta** el «FALLA» del resumen de la app: los cruces no se capturaron en ella y la batería mezcla cargas y uso
normal. Manda el log crudo y las horas de reloj.

### Lecciones

- **Los falsos positivos vienen de la mala precisión.** El par falso del 6 oct (01:47, 4,8 s) llegó con un fix de ±100 m. Con
  radio de 100 m, un fix así basta para cruzar el borde sin moverse. Por eso el filtro contra rebotes y la confirmación con una
  posición fresca son requisitos (abajo), no un detalle.
- **El borde no debe quedar donde la gente pasa mucho tiempo.** La casa del usuario queda a ~28 m del borde y salió una SALIDA
  real tras un paso corto. En una obra real, el radio y el centro deben dejar el borde lejos de la entrada, el estacionamiento
  y el lugar donde se descansa. La app debe aconsejarlo al crear la obra (se tiene en cuenta en la rebanada D, editor de mapa).
- **Dentro del círculo el cruce es limpio; en el borde no.** Los 10 eventos del 9 y 10 oct fueron cruces reales porque el coche
  queda dentro y la casa fuera con margen; la ambigüedad aparece solo cerca del borde.
- **Sin datos móviles sigue detectando.** La detección es del sistema; lo que sí necesita red es sincronizar (cola local en la
  rebanada 2, ver el plan).

## Hallazgos que no estaban en el plan

- **Estado inicial.** Expo registra con `INITIAL_TRIGGER_ENTER | INITIAL_TRIGGER_EXIT`: al registrar (o volver a registrar)
  la geocerca Android informa de inmediato el estado actual. Confirmado en datos: registrar fuera da un Exit al instante.
- **Re-registro.** Cada proceso nuevo de la app (abrirla, arrancar el teléfono, instalar una versión) vuelve a registrar
  las geocercas y genera otro evento de estado actual. Aparece también con la app en segundo plano (el de las 20:19).
- **Rebotes** de 4–5 s entre Exit y Enter cuando el primer fix es malo (±60 a ±100 m).
- **Retraso en la entrega**: un evento llegó con el último fix de hace 89 s.
- **La detección no es instantánea ni con GPS en vivo** (37,5 s en S4; tres cruces tocados en un minuto no generaron
  evento antes de cerrar la sesión).
- **La notificación fija con botones no sobrevive horas** (estaba ausente las tres veces que se abrió la app) y los botones
  nunca se pulsaron: **no está verificada**.
- **Vibración**: ver «Notificaciones» abajo.

## Qué quedó sin medir (el usuario cerró el spike el 2026-10-10)

El laboratorio no recibe nada más. Lo siguiente no se midió y, si importa, se vigila con la app real:

1. **Más cruces con hora de reloj** (el escenario 3 fue de 3 cruces; las parejas del 9 y 10 oct no se cronometraron).
2. **Noches quietas** (escenario 6): solo hay una noche medida, con un falso.
3. **Batería**: «probable», decisión del usuario de no medir más.
4. Ahorro de batería global del sistema (escenario 5), permisos reducidos (8) y «Sin restricciones» (9): ya no condicionan nada,
   porque el escenario 3 pasó con los ajustes por defecto.

## Requisitos para la rebanada 2 (fichaje)

1. **Los eventos son pistas, no la verdad.** El estado dentro/fuera lo decide la app, de forma idempotente, con una
   posición fresca y histéresis. Esto cubre rebotes, duplicados y re-registros.
2. **Filtro contra rebotes.** Un evento contrario dentro de ~60 s anula el par (los observados duraron ≤ 5 s). Si el fix del
   evento tiene precisión peor que ~radio/2, confirmar con una posición fresca antes de actuar. Exigir un tiempo mínimo en
   el nuevo estado antes de abrir o cerrar la entrada, calibrado con más datos.
3. **Re-registro.** Ignorar como cruce todo evento que llegue ≤ 15 s después de (re)registrar la geocerca o justo tras
   arrancar el proceso (boot, abrir la app, instalar). Nunca estampar con él una hora de entrada o salida. Sí usarlo para
   **conciliar**: al arrancar o abrir la app, comparar la posición actual con la entrada abierta y marcar la corrección
   como «estimada».
4. **Hora del evento**: la tarea escribe cuando corre, no cuando se cruzó el borde; guardar siempre el fix (precisión y
   antigüedad) junto con cada evento. Se observaron antigüedades de hasta 89 s.
5. **Latencias de hasta ~3 min** (medidas: 42 s y 2 min 25 s): la interfaz distingue «detectado» de «confirmado». Las
   correcciones de horas con motivo (RF-08, US-09) van en el panel web **y también en el móvil** (decisión del 2026-10-10; ver
   [plan-de-rebanadas.md](plan-de-rebanadas.md)).
6. **Sin conexión**: la tarea headless no puede depender de la red; la cola local de fichajes pendientes con sincronización
   posterior **se adelantó a la rebanada 2** (decisión del 2026-10-10). La detección funciona sin datos móviles (medido).
7. **No depender de notificaciones fijas ni de botones** para el fichaje; el fichaje manual es el respaldo.
8. **Radio mínimo de 100 m** (el mismo radio con un fix de ±100 m produjo un falso); por defecto 150 m. Al crear una obra,
   avisar de que el borde no debe quedar donde la gente pasa mucho tiempo.
9. **El escenario 3 pasó** (la geocerca sobrevive al deslizar la app con los ajustes por defecto de MIUI): basta una guía de
   incorporación opcional (por ejemplo, no deslizar la app en teléfonos con ahorro agresivo). No hace falta un servicio en
   primer plano.
10. **Reconciliar al abrir la app** aunque todo funcione: es barato y cubre cualquier pérdida silenciosa de Google Play
    Services, que la app no puede ver (`hasStartedGeofencingAsync` solo consulta el registro de Expo).
11. **Límite de 100 geocercas por app** (documentación oficial de Android): con muchas obras hay que registrar solo las
    activas o cercanas y renovar el conjunto cuando el teléfono se mueva.

### Hechos verificados en la documentación oficial de Android (developer.android.com, geofencing)

- «For best results, the minimum radius of the geofence should be set between 100 - 150 meters.» (de ahí el mínimo de 100 m
  y el valor por defecto de 150 m en los proyectos).
- «On single-user devices, there is a limit of 100 geofences per app.»
- Latencia: «Usually the latency is less than 2 minutes»; con límites de ubicación en segundo plano «about 2-3 minutes on
  average»; con el dispositivo quieto mucho tiempo «up to 6 minutes». Es coherente con los datos (0–3 min) y significa que el
  criterio de salida ≤ 5 min puede incumplirse de forma legítima con el teléfono quieto.
- Las geocercas no sobreviven a un reinicio, a reinstalar la app ni a borrar sus datos: hay que volver a registrarlas (en
  esta app lo hace Expo al arrancar; confirmado en las pruebas con el reinicio por batería).

### Notificaciones: vibración

- **Con la app abierta es un defecto del laboratorio:** el manejador de primer plano devuelve `shouldPlaySound: false` y
  `expo-notifications` en Android ata la vibración a ese flag (marca la notificación como silenciosa «sin importar el
  canal»). Arreglo: `shouldPlaySound: true` en el manejador (los canales no tienen sonido, solo vibración). Se dejó sin
  aplicar a propósito para no cambiar el APK en mitad de las pruebas. **Aplicado en el código el 2026-10-08**, junto con los
  parches de `expo` (57.0.27), `expo-constants` (57.0.21) y `expo-notifications` (57.0.22); falta compilar el APK `spike`
  nuevo (verificado en el código nativo de `expo-notifications` 57.0.22: la vibración sigue atada a ese flag).
- **Con la app cerrada** no interviene ningún manejador y el canal pide vibración (`setVibrationPattern` + `enableVibration`).
  **Confirmado en el escenario 3 (8 oct): vibró fuerte, como un mensaje de WhatsApp.** No sonó porque el canal es solo de
  vibración. Para la app real, el usuario pide vibración y sonido por defecto, configurable por cada persona en «Más»: en Android
  el sonido y la vibración de un canal **no se pueden cambiar desde la app una vez creado**, así que la rebanada 2 necesitará un
  canal por opción (vibración y sonido, solo vibración, silencioso) y elegir el canal al notificar.

## Cosas que no se midieron bien y por qué

- Todas las sesiones salieron etiquetadas como escenario 1: el selector no se cambió.
- El panel en vivo estuvo encendido en 6 de los 8 eventos con la app abierta: la app misma alimentó al sistema con GPS
  continuo (mejor caso).
- La captura «hace 5 min» fue imprecisa por 91 s: usar HH:MM:SS.
- El resumen de la app llamó «FALLA 5/6» a datos que no sirven para ello (el único «perdido» era esa captura y cuatro de
  los cinco «detectados» eran marcadores posteriores al evento); manda el reanálisis del log crudo.
