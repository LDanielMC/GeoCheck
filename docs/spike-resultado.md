# Resultado del spike de geofencing

Fecha: 2026-10-07 · Dispositivo: Xiaomi Redmi Note 10 Pro (Android 13, MIUI 14), ajustes de batería por defecto
(«Ahorro de batería (recomendado)», sin «Sin restricciones») · Datos: dos exportaciones del log del laboratorio,
la verdad de campo que aportó el usuario y la lectura del código nativo de Expo.

## Veredicto

**Viable, con condiciones.** Lo que podía hundir el enfoque, que el geofencing nativo funcione con la app cerrada en un
Xiaomi, **salió bien**: despierta el proceso muerto, y sobrevive a un apagado y encendido del teléfono sin abrir la app.
Lo que falta es **cuantificar** (cuántos cruces se pierden, cuánto tarda en segundo plano, cuántos falsos hay) y despejar
**un riesgo grande sin medir**: qué pasa cuando el usuario **desliza la app de Recientes** (MIUI puede tratarlo como
«forzar detención», que borra las geocercas hasta que la app vuelva a arrancar).

Recomendación: **empezar la rebanada 1** (no depende de lo que falta). La rebanada 2 (fichaje) se diseña con los
requisitos de abajo y queda **condicionada al resultado del escenario 3**.

## Criterios acordados

| Criterio | Estado | Evidencia |
|---|---|---|
| ≥ 90 % de entradas y salidas detectadas | **Sin muestra suficiente; ningún fallo observado** | 1 de 1 salida real en segundo plano detectada (15:45). Con GPS en vivo se detectaron todas las salidas (S4, S6–S9), pero es el mejor caso. Ninguna pérdida confirmada |
| Latencia de entrada ≤ 3 min | **Sin dato** | No hay una entrada real medida (el ENTER de las 12:46 fue un re-registro) |
| Latencia de salida ≤ 5 min | **Cumple de forma provisional (n=1)** | 0–3 min en segundo plano con el proceso muerto (salió entre 15:42 y 15:45; evento 15:45:02). 37,5 s con GPS en vivo (S4, medida válida) |
| ≤ 1 transición falsa por día quieto | **En el límite (1 día)** | 1 pareja Exit/Enter falsa en ~20 h en casa (01:47, separadas 4,8 s; el Exit con fix de ±100 m y radio de 100 m) |
| Batería ≤ 3 % por jornada | **Probable (decisión del usuario: se deja así, no se medirá más)** | GeoCheck = 3,35 % del *uso total* (cuota de consumo, no % de batería), CPU 4 min 10 s, GPS 15 min 46 s casi todo del panel en vivo. Falta el denominador (cuánto % total se consumió en ese periodo) |
| Funciona con la app cerrada | **Confirmado** | 4 eventos con el proceso muerto (JS recién cargado, ~0,98 s, app en segundo plano) y un cruce real (15:45) |
| Tras reiniciar el teléfono | **Confirmado** | Apagado por batería, encendido sin abrir la app: Expo re-registró la geocerca (el ENTER de las 12:46) y 3 h después se detectó una salida real |
| Con la app deslizada de Recientes | **Sin medir (riesgo principal)** | El usuario nunca la deslizó. «Proceso muerto» en los eventos es el estado normal tras una tarea headless, no equivale a haberla cerrado a la fuerza |

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

## Qué falta medir (en orden)

1. **Escenario 3** (app deslizada de Recientes): 5 salidas y 5 entradas caminando, panel apagado, hora exacta del cruce
   con reloj (HH:MM:SS), sin abrir la app entre cruces. Es lo que decide la rebanada 2.
2. **Escenario 10** (salida con el teléfono bloqueado y sin tocarlo 10 min): latencia sin interacción.
3. **Entradas reales** en segundo plano: ninguna medida.
4. **Noches quietas** (escenario 6): al menos 2 más, para estimar los falsos por día con un solo dato.
5. **Batería**: el denominador (cuánto % total se consumió desde la última carga) o un día sin panel en vivo.
6. Poco prioritarios: ahorro de batería global del sistema (escenario 5), permisos reducidos (8), y «Sin restricciones»
   (9), que solo importa si el escenario 3 falla.

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
5. **Latencias de hasta ~3 min**: la interfaz distingue «detectado» de «confirmado» y permite ajustar horas (RF-08).
6. **Sin conexión**: la tarea headless no puede depender de la red; la cola local con sincronización posterior es parte
   de la rebanada 3.
7. **No depender de notificaciones fijas ni de botones** para el fichaje; el fichaje manual es el respaldo.
8. **Radio mínimo de 100 m** (el mismo radio con un fix de ±100 m produjo un falso); por defecto 150 m.
9. **Si el escenario 3 falla** (la geocerca se pierde al deslizar la app): guía de incorporación (bloquear la app en
   Recientes, inicio automático) y valorar un servicio en primer plano como respaldo. Si no falla, basta la guía.
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
  canal»). Arreglo: `shouldPlaySound: true` en el manejador (los canales no tienen sonido, solo vibración). Está sin
  aplicar para no obligar a recompilar el APK en mitad de las pruebas.
- **Con la app cerrada** no interviene ningún manejador y el canal sí pide vibración (`setVibrationPattern` +
  `enableVibration`), así que el bloqueo está en el teléfono: revisar en MIUI Ajustes › Notificaciones › GeoCheck › canal
  «Detección de cruces (vibra)» (vibración activada), «Vibrar en modo silencioso» y No molestar. Pendiente de confirmar.

## Cosas que no se midieron bien y por qué

- Todas las sesiones salieron etiquetadas como escenario 1: el selector no se cambió.
- El panel en vivo estuvo encendido en 6 de los 8 eventos con la app abierta: la app misma alimentó al sistema con GPS
  continuo (mejor caso).
- La captura «hace 5 min» fue imprecisa por 91 s: usar HH:MM:SS.
- El resumen de la app llamó «FALLA 5/6» a datos que no sirven para ello (el único «perdido» era esa captura y cuatro de
  los cinco «detectados» eran marcadores posteriores al evento); manda el reanálisis del log crudo.
