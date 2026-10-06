// Log real de la primera prueba de campo (2026-10-05, Xiaomi Redmi Note 10 Pro), SIN coordenadas.
// Es el caso de regresión de dos fallos del análisis anterior:
//  - el Enter inicial tras re-registrar (23:32:57) se emparejaba con un marcador "enter" tocado 26 s antes
//    y salía "detectado en 26 s";
//  - dos geocercas distintas (centros a ~180 m) se mezclaban como si fueran una sola prueba.
// Los tres eventos llegaron con la app en primer plano; ninguno es un evento en segundo plano.

import type { SpikeEntry } from "../analysis";

const RAW = `
{"t":"2026-10-05T23:21:03.940Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"undetermined","foregroundAccuracy":"none","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:21:04.096Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"undetermined","foregroundAccuracy":"none","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:21:49.284Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"denied","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:22:03.274Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"permission","foreground":"granted","foregroundAccuracy":"fine","background":"granted"}
{"t":"2026-10-05T23:22:03.283Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:22:19.070Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:22:29.746Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:22:42.845Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"app_open","registered":false,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:22:56.295Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"register","radius":100}
{"t":"2026-10-05T23:22:56.480Z","batteryLevel":1,"charging":true,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"geofence","type":"enter","regionState":"Inside","appState":"active","jsUptimeMs":112810,"cold":false,"lastFixAccuracyM":12.4,"lastFixAgeS":5}
{"t":"2026-10-05T23:26:31.039Z","batteryLevel":1,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"app_open","registered":true,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:32:01.678Z","batteryLevel":0.96,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"snapshot"}
{"t":"2026-10-05T23:32:31.563Z","batteryLevel":0.96,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"marker","type":"enter"}
{"t":"2026-10-05T23:32:32.641Z","batteryLevel":0.96,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"geofence","type":"exit","regionState":"Outside","appState":"active","jsUptimeMs":688938,"cold":false,"lastFixAccuracyM":19.3,"lastFixAgeS":2}
{"t":"2026-10-05T23:32:48.820Z","batteryLevel":0.95,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":false,"kind":"unregister"}
{"t":"2026-10-05T23:32:57.347Z","batteryLevel":0.95,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"register","radius":100}
{"t":"2026-10-05T23:32:57.524Z","batteryLevel":0.95,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"geofence","type":"enter","regionState":"Inside","appState":"active","jsUptimeMs":713848,"cold":false,"lastFixAccuracyM":10.3,"lastFixAgeS":5}
{"t":"2026-10-05T23:33:57.157Z","batteryLevel":0.94,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"app_open","registered":true,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:35:12.410Z","batteryLevel":0.93,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"app_open","registered":true,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:36:48.248Z","batteryLevel":0.91,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"marker","type":"exit"}
{"t":"2026-10-05T23:37:33.884Z","batteryLevel":0.91,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"app_open","registered":true,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
{"t":"2026-10-05T23:38:12.049Z","batteryLevel":0.9,"charging":false,"scenario":"1","batteryProfile":"default","geofenceActive":true,"kind":"app_open","registered":true,"background":"granted","foregroundAccuracy":"fine","servicesEnabled":true,"batteryOptimization":true,"lowPowerMode":false}
`;

export const FIELD_LOG_2026_10_05: SpikeEntry[] = RAW.trim()
  .split("\n")
  .map((line) => JSON.parse(line) as SpikeEntry);

// Hora a la que se exportó el log: el "ahora" con el que se calcularon los pendientes.
export const FIELD_LOG_EXPORTED_AT = Date.parse("2026-10-05T23:38:59.430Z");
