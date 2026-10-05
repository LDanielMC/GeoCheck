# Spike de geofencing — guía de campo

Objetivo: validar en un Android real si el geofencing nativo detecta entradas y salidas **con la app cerrada**,
con qué latencia y precisión, y a qué costo de batería, antes de construir el resto de la app.

El laboratorio (`mobile/src/screens/GeofenceLabScreen.tsx`) guarda todo **solo en el teléfono**: no usa sesión ni
servidor. Cada evento queda en un log con hora, tipo, batería y si la app estaba cerrada ("en frío").

## 1. Qué build usar (importante)

| Para qué | Build | Por qué |
|---|---|---|
| Probar la pantalla, permisos y el flujo (escenarios 1 y 2) | `development` + Metro | Recarga rápida |
| **Escenarios 3 a 9 (app cerrada, reinicio, batería, noche)** | **`spike` (APK release)** | El APK `spike` lleva el JS embebido. Un development build necesita Metro para cargar el JS: con la app cerrada y la PC apagada, la tarea del evento no tiene código que ejecutar y **el evento se pierde**. Además un build de desarrollo gasta más batería y falsearía la medición |

Compilar el APK `spike` (necesita tu sesión de EAS; la primera vez pregunta por el keystore de Android):

```powershell
cd mobile
npm run build:spike:android
```

Al terminar, EAS da un enlace/QR para descargar el APK e instalarlo. Si ya tienes el development build instalado,
el APK `spike` lo reemplaza (mismo paquete y misma firma); si Android no lo deja actualizar, desinstala primero la app anterior.

Para correr el laboratorio con Metro (development build o Expo Go sin geofencing en segundo plano):

```powershell
cd mobile
$env:EXPO_PUBLIC_SPIKE = "1"
npx expo start --dev-client --clear     # --clear: Metro cachea el valor de la variable y no lo relee si cambias
```

## 2. Preparar el teléfono (Xiaomi / MIUI 14)

Hazlo una vez, antes de la primera prueba, y apúntalo en el log con el **perfil de batería** que uses
(la pantalla tiene el selector "Ajustes por defecto" / "Sin restricciones + inicio automático").

1. Abre la app › **Pedir permisos de ubicación**. Elige **Permitir con la app en uso** y, en la pantalla siguiente,
   **Permitir todo el tiempo** y **Usar ubicación precisa**.
2. Para el **perfil "por defecto"**: no toques nada más.
3. Para el **perfil "sin restricciones"** (escenario 9):
   - Ajustes › Aplicaciones › Administrar aplicaciones › GeoCheck › **Ahorro de batería** › **Sin restricciones**.
   - Ajustes › Aplicaciones › Permisos › **Inicio automático** › activar GeoCheck.
   - En Recientes, mantén pulsada la tarjeta de GeoCheck › **candado**.
   - Los botones de la pantalla intentan abrir estos ajustes; en MIUI pueden caer a los ajustes generales de la app.

## 3. Crear la geocerca de prueba

1. Párate donde quieras el **centro** (por ejemplo el centro del parque) y toca **Usar mi ubicación como centro**.
   Espera a que la precisión sea buena (±20 m o menos).
2. Elige el radio: **150 m** para empezar (Android recomienda ≥100 m; si el radio es más chico los resultados
   serán peores y no representan la app final).
3. **Registrar geocerca**. Si estás dentro, Android puede disparar una *entrada* inmediata: el análisis la separa.
4. Para cambiar centro o radio hay que **quitar** la geocerca primero.

## 4. Protocolo por escenario

Elige el escenario en la sección 3 de la pantalla **antes** de empezar (todo el log queda etiquetado con él).
Repite **al menos 5 entradas y 5 salidas** por escenario (menos en 6 y 7, que son de larga duración).

Para cada cruce: camina hacia la frontera, y **toca "Estoy ENTRANDO" / "Estoy SALIENDO" en el instante en que
la cruzas**. Tras cruzar sigue unos 100 m más y espera hasta 10 minutos antes del siguiente cruce, para dar tiempo
al evento. No cierres ni abras la app salvo que el escenario lo diga.

| # | Escenario | Cómo |
|---|---|---|
| 1 | App abierta | App en primer plano durante el cruce. Línea base |
| 2 | Segundo plano, pantalla bloqueada | Botón Inicio, bloquear pantalla, cruzar |
| 3 | **App cerrada** | Deslizar la app fuera de Recientes y **no abrirla** hasta después del cruce. Es el caso crítico |
| 4 | Tras reiniciar | Registrar, reiniciar el teléfono, **no abrir la app**, cruzar. Luego abre la app: el log dirá si la geocerca desapareció (`geofence_missing`) |
| 5 | Ahorro de batería | Activar el ahorro de batería de MIUI y repetir cruces |
| 6 | Noche quieto | Dejar el teléfono quieto toda la noche dentro del radio (mejor cerca del borde). No marcar nada |
| 7 | Quieto cerca del borde, 1–2 h | Quedarse quieto dentro, cerca del borde. No marcar nada: cada evento es un falso |
| 8 | Permisos reducidos | Quitar "Permitir todo el tiempo" o dejar ubicación aproximada; anotar qué falla |
| 9 | Batería: con y sin exclusión | Ver abajo |

Notas:
- En los escenarios 6, 7 y 8 no se marcan cruces: lo que cuenta son los eventos "sin marcador".
- **Escenario 4:** se añadió el permiso `RECEIVE_BOOT_COMPLETED` al build. Sin él Android no avisa a la app al
  arrancar. Es la hipótesis a confirmar con esta prueba.

## 5. Batería

Dos tramos de al menos **8 horas** cada uno, sin cargador, uso normal del teléfono y misma rutina:

- **Tramo A:** geocerca activa. **Tramo B:** geocerca quitada.
- Al empezar y al terminar cada tramo toca **Guardar lectura de batería** (con una nota: "inicio A", "fin A"…).
- Al terminar, anota también el valor de GeoCheck en Ajustes › Batería › **Uso por aplicación** (es el dato fiable;
  el cálculo de la app es una estimación gruesa).
- Repite A y B con cada perfil de batería si quieres comparar (escenario 9).

## 6. Qué mandarme

Toca **Exportar log (compartir)** y envíalo (Drive, correo, WhatsApp a ti mismo…). El archivo trae arriba un
resumen con los criterios (✅/❌), después los datos del dispositivo y el log crudo. Pega su contenido en la conversación.
Añade a mano: los valores de batería de Ajustes y cualquier cosa rara que notes (notificaciones de MIUI, "la app
se detuvo", etc.).

## 7. Criterios de éxito acordados

- ≥ 90 % de entradas y salidas detectadas.
- Latencia: entrada ≤ 3 min, salida ≤ 5 min.
- ≤ 1 transición falsa por día estando quieto con radio ≥ 150 m.
- Costo de batería atribuible a la app ≤ 3 % por jornada.
- Funciona con la app deslizada de Recientes y tras reiniciar (quizá con una configuración guiada de batería).

## 8. Qué decide el resultado

- **Cumple:** rebanada 1, con el contrato real de fichaje y un debounce calibrado con estos datos.
- **Débil solo en algunos escenarios:** se compensa en el diseño (confirmar con una posición actual tras cada evento,
  pantallas guiadas para excluir la app de la optimización de batería, re-registrar geocercas al abrir la app).
- **Falla de fondo:** alternativas (librería nativa de geofencing, o ubicación por distancia con servicio en primer
  plano), lo que cambia el plan de las rebanadas 2 y 3.
