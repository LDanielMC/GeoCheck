# Decisiones de GeoCheck

## Proceso
- **Trabajo por rebanadas verticales** (funcionalidad completa de punta a punta), no por secciones del documento ni todo de golpe: así lo riesgoso se prueba pronto. Un commit por rebanada o paso.
- **Antes de implementar algo grande, mostrar el alcance y los criterios** para que el usuario los apruebe.
- **No agregar funciones fuera del plan sin preguntar.**
- **No levantar infraestructura temporal** (bases de datos, emuladores, descargas grandes) sin pedirlo.
- El spike de geocercas se hizo **antes** de construir encima porque era el mayor riesgo del proyecto.

## Infraestructura
- **PostgreSQL desde el inicio** (Docker en local), no SQLite, para no tener diferencias al pasar a producción. Supabase queda para producción.
- **Sin PostGIS:** nada lo usaba; la distancia se calcula con haversine.
- **Hosting del backend: sin decidir.** Opciones investigadas: Cloud Run, Fly.io, Railway y Render (el plan gratis de Render se duerme y no sirve para fichaje).
- La app se publicará en la **cuenta de Google Play del desarrollador**, al inicio en pruebas internas. Paquete `com.cliche.geocheck` (permanente).

## Geocercas (resultado del spike: viable)
- Funciona con la app cerrada, quitada de recientes y tras reiniciar el teléfono, con la configuración por defecto de MIUI. Latencias medidas: salida 2 min 25 s y entrada 42 s con la app quitada de recientes; salida de 0 a 3 min con la app cerrada.
- La detección funciona sin datos móviles (el envío al servidor no).
- **Radio mínimo de 100 m:** hubo falsos positivos con precisión de ±60 a ±100 m.
- **Los eventos son pistas, no verdades:** la app decide con posición fresca e histéresis, filtra rebotes e ignora los re-registros (estado inicial al registrar, al arrancar la app o tras reiniciar).
- **El borde no debe quedar donde la gente pasa mucho tiempo.**
- El fichaje automático **requiere development build o APK propio**; Expo Go no sirve para segundo plano.
- Permiso RECEIVE_BOOT_COMPLETED agregado para sobrevivir reinicios. El permiso de exclusión de batería está restringido por Google Play: hay que justificarlo o quitarlo antes de publicar.
- El laboratorio del spike (`src/spike`) queda **congelado**.

## Obras y mapas
- Mapa: **react-native-maps** (Google en Android, Apple en iOS). Clave de Android en EAS, nunca en el repositorio.
- Búsqueda por dirección: **autocompletado con Google Places API (New) a través del backend** (clave separada, solo en el servidor, restringida a esa API, con límites por usuario, tope diario y alerta de presupuesto de $5). **Respaldo:** el geocodificador del teléfono.
- Detalles del lugar solo con ubicación y dirección (categoría Essentials, para no subir el costo).
- Se puede pegar el par "latitud, longitud" que copia Google Maps.
- Miniaturas en la lista de obras con react-native-maps en modo ligero, con respaldo de un ícono; nada de la API de imágenes estáticas.
- Se guarda la dirección en cada obra (columna `address`, aprobada).

## Diseño (rebanada D)
- Identidad propia: verde obra (#1E6B3C), amarillo chaleco para avisos, ladrillo para salida y errores; Barlow Condensed y Public Sans; íconos de trazo (Lucide); símbolo de pin + anillo punteado + palomita.
- Patrones de Supercrew adaptados: pestañas inferiores, Inicio con estado, editor de obra en mapa a pantalla completa, tarjetas, línea de tiempo, "Más" agrupado, pantallas vacías y hojas inferiores.
- **Inicio centrado en el estado** ("Dentro de [obra] desde 7:02 · automático"), con el botón manual como respaldo discreto.
- **Todos los textos en un solo archivo** (`src/texts/es.ts`) para traducir al inglés después sin tocar pantallas.
- Barra de pestañas propia sobre navegación por estado (sin librería).
- Sin modo oscuro por ahora.

## Roles y operación (reunión con el cliente)
- **El administrador ficha**, y su fichaje es tan visible como el resumen de su equipo.
- **Asignación de empleados a obras** (rebanada 1b) y **estado En curso / Terminada**.
- **Se pagan los traslados dentro de la jornada**, no el trayecto casa ↔ obra.
- **Se eliminan los horarios de empleados**: la hora de llegada real es la que cuenta.
- **El empleado no aclara ni corrige en la app**; el sistema marca y el dueño decide. Las solicitudes de corrección del empleado se eliminaron.
- **Lo dudoso no se paga hasta que el dueño lo apruebe.**
- **La revisión y el pago van en el móvil** (rebanada R), porque el dueño usa el teléfono; el panel web (W) es complementario.
- **Cola de fichajes sin conexión adelantada a la rebanada 2.**
- Sin historial de rutas ni ubicación continua (RF-15: ubicación solo en los fichajes), salvo la confirmación de presencia periódica mientras hay un fichaje abierto, que se evaluará en la rebanada 2.
- Notificaciones del fichaje con vibración y sonido por defecto, configurables en "Más".
- Reglas de nómina configurables por organización; nada legal fijo en el código.

## Orden de rebanadas pendientes
1. D2 (login, registro y unirse).
2. 1b (personas y obras: equipo, asignación y estado de obra).
3. D3 a D6 (editor y lista de obras, Inicio por rol y Equipo, cierre).
4. 2 (fichaje: automático en obras asignadas, manual con reglas, jornada, traslados, comida, confirmación de presencia, cola sin conexión, marcas "por revisar", mis horas).
5. R (revisión y pago en el móvil).
6. W (panel web y exportación).
7. 3 (batería y robustez).
8. 5 (supervisor: quién está en obra y fichar por otros).