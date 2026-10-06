# Spike de geofencing — guía de campo

Objetivo: validar en un Android real si el geofencing nativo detecta entradas y salidas **con la app cerrada**,
con qué latencia y precisión, y a qué costo de batería, antes de construir el resto de la app.

El laboratorio (`mobile/src/screens/GeofenceLabScreen.tsx`) guarda todo **solo en el teléfono**: no usa sesión ni
servidor. Cada evento queda en un log con hora, tipo, batería y si la app estaba cerrada ("en frío").

## 1. Qué build usar (importante)

| Para qué | Build | Por qué |
|---|---|---|
| Probar la pantalla, permisos y el flujo (escenarios 1 y 2) | `development` + Metro | Recarga rápida |
| **Escenarios 3 a 10 (app cerrada, reinicio, batería, noche)** | **`spike` (APK release)** | El APK `spike` lleva el JS embebido. Un development build necesita Metro para cargar el JS: con la app cerrada y la PC apagada, la tarea del evento no tiene código que ejecutar y **el evento se pierde**. Además un build de desarrollo gasta más batería y falsearía la medición |

Compilar el APK `spike` (necesita tu sesión de EAS):

```powershell
cd mobile
npm run build:spike:android
```

> **Hay que recompilar el APK siempre que cambien las dependencias nativas.** La versión con panel en vivo,
> notificaciones y diálogo de batería añade `expo-notifications`, `expo-intent-launcher` y `expo-keep-awake`: el
> APK anterior no las tiene y el JS nuevo no funciona sobre él.

Al terminar, EAS da un enlace/QR para descargar el APK. Si ya tienes una versión instalada, la nueva la reemplaza
(mismo paquete y firma) y **el log y la configuración se conservan**; si Android no deja actualizar, desinstala primero
(se pierde el log: expórtalo antes).

Para correr el laboratorio con Metro (development build):

```powershell
cd mobile
$env:EXPO_PUBLIC_SPIKE = "1"
npx expo start --dev-client --clear     # --clear: Metro cachea el valor de la variable y no lo relee si cambias
```

## 2. Preparar el teléfono (Xiaomi / MIUI 14)

Hazlo una vez, antes de la primera prueba. La sección 1 de la pantalla muestra el estado de cada cosa (en **rojo** lo
que impediría medir bien).

1. **Pedir permisos (ubicación y notificaciones).** Elige «Permitir con la app en uso», luego «Permitir todo el tiempo»
   y «Usar ubicación precisa». Acepta las notificaciones (Android 13 las pide aparte).
2. **Notificaciones de MIUI** (botón «Ajustes de notificaciones»): activa las notificaciones flotantes y la vibración
   para los canales de GeoCheck, o el aviso de detección llegará mudo.
3. **Bloquea la app en Recientes** (mantén pulsada su tarjeta › candado).
4. **Perfil de batería.** El laboratorio pide declarar el perfil con el que pruebas y **no te deja iniciar una sesión
   si lo declarado no coincide con lo que Android reporta**:
   - Perfil «Ajustes por defecto»: la optimización de batería debe aparecer ACTIVA (es lo normal).
   - Perfil «Sin restricciones»: toca **«Pedir exclusión de batería (diálogo del sistema)»** y acepta. Eso cambia la
     lista blanca de Android (la que lee la app). Además pon «Sin restricciones» en MIUI (Ajustes › Aplicaciones ›
     Administrar aplicaciones › GeoCheck › Ahorro de batería) y activa el **Inicio automático**.
   - ⚠ El «Sin restricciones» de MIUI **es otro interruptor** distinto del de Android: la app no lo puede ver. Si
     ya lo pusiste en MIUI y la app sigue en rojo, usa el diálogo del sistema; si aun así no cambia puedes iniciar
     con «Iniciar de todos modos»: la sesión queda marcada como *verificación forzada* en el log.
   - Los botones de MIUI («Ahorro MIUI», «Inicio automático») son intentos sin verificar: si no abren la pantalla
     correcta caen a los ajustes de la app.

## 3. Sesiones: nada se mezcla

Una **sesión** es una geocerca registrada con escenario, perfil de batería, centro y radio fijos.

- «Iniciar sesión» registra la geocerca; «Terminar sesión» la quita. Mientras hay una sesión en curso **no se puede
  cambiar** el escenario, el perfil, el centro ni el radio (ni borrar el log).
- Si cambias el centro (o el radio) tienes que terminar la sesión e iniciar otra: son **datos distintos** y el análisis
  nunca empareja un marcador de una sesión con un evento de otra.
- Si Expo ya no tiene la tarea registrada (datos de la app borrados, por ejemplo), al abrir la app la sesión se cierra
  como `missing`. **Ojo: el laboratorio no puede ver si Google Play Services perdió la geocerca**: Expo la vuelve a
  registrar al arrancar y `hasStartedGeofencingAsync` solo consulta el registro de Expo. La prueba de una geocerca
  perdida es un marcador **sin evento** (resultado «perdido»), no un aviso de la app.
- **Estado inicial.** Expo registra la geocerca pidiendo a Android que informe el estado actual (`INITIAL_TRIGGER_ENTER |
  INITIAL_TRIGGER_EXIT`): al registrarla recibes de inmediato «entrada» si estás dentro o «salida» si estás fuera. No es
  un cruce: el análisis lo aparta y no lo empareja con ningún marcador. (En la primera prueba este evento se confundió con
  una detección.)
- **Re-registro al abrir la app.** Cada vez que arranca un proceso NUEVO de la app (la abres después de haberla cerrado,
  o un evento la despierta), Expo vuelve a registrar la geocerca y Android informa otra vez el estado actual. Por eso, tras
  un escenario con la app cerrada, **abrirla produce un evento al instante que no es una detección**: si lo
  contaras, un cruce que el sistema nunca avisó parecería detectado. El laboratorio lo marca como *re-registro* (JS recién
  cargado + app en primer plano, o un evento repetido del mismo tipo a ≤ 10 s) y lo aparta. Esto sale de leer el código de
  `expo-location`/`expo-task-manager`; hay que confirmarlo en el teléfono.

## 4. Panel en vivo: encontrar el borde

Con la app abierta, el panel de arriba muestra tu distancia al centro, el radio, si el GPS te ve **dentro/fuera**,
la precisión del GPS y cuánto falta para cruzar **con margen** (50 m, o más si el GPS es malo), además del último
evento que detectó el sistema y si hay un marcador esperando su evento.

- Úsalo para el **reconocimiento previo**: recorre el borde una vez y elige un punto de referencia en el borde (poste,
  árbol, esquina) y otro 50 m más afuera.
- Mantiene la pantalla encendida y se detiene solo al salir de la app.
- ⚠ **Contamina la medición**: mientras corre, la app pide ubicación a ~1 Hz, y eso puede acelerar la detección del
  sistema. Cada evento queda marcado (`liveWatch`) en el log. Es para encontrar el borde y para el escenario 1, no
  para medir en segundo plano.

## 5. Marcar los cruces

La latencia es **hora del evento − hora real del cruce**, así que hace falta saber cuándo cruzaste. Hay tres formas:

1. **Botones de la app** («Estoy ENTRANDO/SALIENDO»): solo si la app está abierta (escenario 1 y 10).
2. **Notificación fija con «Entré» / «Salí»** (interruptor «Marcar sin abrir la app»): marca **sin abrir la app**,
   también con la app en segundo plano o cerrada, y confirma con una vibración corta. Funciona porque los botones no
   abren la app y el sistema ejecuta una tarea en segundo plano.
   - Se pierde al reiniciar el teléfono y puede desaparecer si MIUI cierra la app «a la fuerza». La app te avisa al
     abrirla si ya no está.
   - Si la app estaba cerrada, la pulsación arranca el proceso y el marcador se escribe 1–3 s después (queda
     `cold: true` en el log).
   - **Si la pulsación no vibra, no se guardó**: usa la tercera forma.
3. **Agregar cruce con hora**: captura después el cruce con su hora real («hace 5 min» o «17:36:20»). Va a la sesión
   que estaba abierta a esa hora. Úsala en el escenario 4 (reinicio) y cuando la notificación no esté.

**Deshacer el último marcador** anula un toque por error. Dos toques seguidos del mismo botón cuentan como uno.

Cada vez que el sistema detecta un cruce, el teléfono **vibra con una notificación** («SALIDA detectada · 17:36:12»,
con cuánto tardó respecto a tu marcador, si lo hay). Así sabes en el campo que ya se detectó.

## 6. Protocolo por escenario

La pantalla muestra, para el escenario elegido, dónde empezar (dentro o fuera), hasta dónde caminar (según el radio),
cómo debe estar el teléfono, qué hacer al cruzar y cuántas veces repetir. Resumen:

| # | Escenario | Idea |
|---|---|---|
| 1 | App abierta | Línea base, con el panel en vivo |
| 2 | Segundo plano, pantalla bloqueada | Sal con Inicio y bloquea; marca con la notificación |
| 3 | **App cerrada** | Desliza la app de Recientes y no la abras; es el caso crítico |
| 4 | Tras reiniciar | Registra, reinicia, no abras la app; captura la hora después |
| 5 | Ahorro de batería | Con el ahorro del sistema ACTIVO (la app lo comprueba) |
| 6 | Noche quieto (Doze) | Quieto toda la noche a ~30 m del borde, SIN cargador; no marcar nada |
| 7 | Quieto cerca del borde, 1–2 h | Igual, más corto; cada evento real es un falso |
| 8 | Permisos reducidos | Quita «Permitir todo el tiempo» o deja ubicación aproximada |
| 9 | Batería: con y sin exclusión | Mismo escenario con los dos perfiles |
| 10 | **Diagnóstico: ¿la salida espera a que algo pida ubicación?** | Ver abajo |

Repite **al menos 5 entradas y 5 salidas** por escenario (menos en 6 y 7). Un resultado con menos muestras sale como
«pocos datos», no como OK ni FALLA.

### Escenario 10: ¿la salida solo se dispara cuando algo pide ubicación?

En la primera prueba la salida llegó 1 s después de tocar un botón de la app, con la app en primer plano; el log no
permite saber si fue casualidad. En Android se reporta con frecuencia que las transiciones se evalúan cuando alguien pide
ubicación (la app, otra app, una interacción con el teléfono); aquí hay que medirlo en este teléfono. Para medirlo sin ambigüedad:

1. Registra dentro; con el panel identifica la meta (≥ radio + 50 m).
2. Toca «Estoy SALIENDO» al pisar el borde; apaga el panel, bloquea la pantalla y camina a la meta sin mirar el teléfono.
3. Quédate quieto afuera **10 min con el teléfono bloqueado**. Si vibra «SALIDA detectada», fin de la repetición.
4. Si a los 10 min no vibró: abre la app (el panel pide ubicación) y no toques nada. El log dirá si el evento llegó
   justo después.

El resumen exportado trae el **Diagnóstico**: cuántos eventos llegaron con la app en primer plano, en frío, a ≤ 10 s de
una interacción tuya y con el panel encendido, y cuántos fueron re-registros. Hay tres explicaciones posibles para un
evento que llega justo al tocar el teléfono, y el log las separa:

1. **Re-registro** (la app arrancó de cero): ver la sección 3. No es una detección.
2. **El sistema espera a que algo pida ubicación** (la app, otra app, el panel): casi todos los eventos llegarán junto a
   una interacción o con el panel encendido. Habría que diseñar para eso (p. ej. un servicio de ubicación de bajo consumo).
3. **Casualidad**: el evento habría llegado igual; en el escenario 10 llega solo, con el teléfono bloqueado.

## 7. Batería

El criterio es ≤ 3 % por jornada: es pequeño, y con uso normal del teléfono (pantalla, sol, GPS) la variación entre dos
días es varias veces mayor. Por eso:

- Mide con el teléfono **sin usar**: dos noches iguales (misma hora, mismo lugar, pantalla bloqueada, sin cargador), una
  con la geocerca activa y otra sin ella. Guarda lectura de batería al empezar y al terminar cada una.
- Anota siempre el valor de GeoCheck en Ajustes › Batería › **Uso por aplicación**: es el dato fiable. El cálculo de la
  app es una estimación gruesa que mezcla todo el consumo.
- Una noche quieto subestima el costo de moverse: complétalo con el uso de una jornada con recorridos.

## 8. Qué mandarme

Toca **Exportar log (compartir)** y envíalo. El archivo trae arriba un resumen (criterios, sesiones, diagnóstico),
después los datos del dispositivo y el log crudo (las coordenadas del centro se redondean a ~110 m). Pega su contenido
en la conversación y añade a mano: los valores de batería de Ajustes y lo raro que notes (MIUI cerró la app,
notificaciones que no vibraron, etc.).

## 9. Criterios de éxito acordados

- ≥ 90 % de entradas y salidas detectadas.
- Latencia: entrada ≤ 3 min, salida ≤ 5 min.
- ≤ 1 transición falsa por día estando quieto con radio ≥ 150 m.
- Costo de batería atribuible a la app ≤ 3 % por jornada.
- Funciona con la app deslizada de Recientes y tras reiniciar (quizá con una configuración guiada de batería).

## 10. Qué decide el resultado

- **Cumple:** rebanada 1, con el contrato real de fichaje y un debounce calibrado con estos datos.
- **Débil solo en algunos escenarios:** se compensa en el diseño (confirmar con una posición actual tras cada evento,
  pantallas guiadas para excluir la app de la optimización de batería, re-registrar geocercas al abrir la app).
- **Falla de fondo:** alternativas (librería nativa de geofencing, o ubicación por distancia con servicio en primer
  plano), lo que cambia el plan de las rebanadas 2 y 3.

## Para quien mantiene el código

- `mobile/src/spike/`: la lógica pura (`analysis`, `geo`, `preflight`, `scenarios`, `time`) se prueba sin dispositivo; el
  resto (`spikeStorage`, `geofenceLab`, `labNotifications`, `geofenceTask`) se prueba contra módulos de Expo simulados
  (`vitest.setup.ts`). `cd mobile && npm test`.
- `__fixtures__/fieldLog20261005.ts` es el log real de la primera prueba (sin coordenadas): caso de regresión del
  análisis.
- El permiso `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (diálogo de exclusión de batería) es solo para el spike: Google Play
  lo restringe, hay que justificarlo o quitarlo antes de publicar.
- Las tareas en segundo plano (`geofenceTask`, y la de los botones en `labNotifications`) se definen en el alcance
  global y se importan siempre desde `App.tsx` vía `register.ts`.
