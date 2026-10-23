# Contexto de GeoCheck

## Qué es
GeoCheck es una app de control de horas por geolocalización (geocercas) para una empresa de pintura de casas. Registra automáticamente la entrada y la salida de los trabajadores cuando llegan a una obra o se van de ella, sin que tengan que abrir la app. La referencia funcional es **Supercrew** (antes ConstructionClock): el análisis de requisitos (`Analisis_Requisitos_ConstructionClock.md`) se hizo a partir de esa app. Se toma su estructura y experiencia, **no** su marca, logo, colores, ilustraciones ni textos.

## Para quién
- **Cliente:** un empresario (tío del desarrollador) con una empresa de pintura de casas en **Oregon, EE. UU.** (hora del Pacífico).
- **Desarrollador:** Luis Daniel Moctezuma (Cliché Marketing Digital), en Cuernavaca, México.
- **Usuarios finales:** el dueño (administrador) y sus trabajadores. Los trabajadores **casi no usan tecnología**, van por su paga y les conviene que se les paguen más horas: la app no debe darles forma de inflar sus horas.
- El dueño usa la app **principalmente desde el teléfono**; la computadora es un extra.

## Stack
**Backend** (`backend/`)
- Node.js + Express 4 + TypeScript.
- Prisma 5.22 con PostgreSQL 16 (local en Docker con `docker-compose.yml`; Supabase previsto para producción, sin desplegar).
- zod (validación), JWT (jsonwebtoken), bcryptjs, express-rate-limit.
- Pruebas: vitest + supertest contra una base `*_test` aparte.
- Google Places API (New) a través del backend (`GOOGLE_PLACES_API_KEY`, solo en el servidor).

**Móvil** (`mobile/`)
- Expo SDK 57, React Native 0.86, React 19.2, TypeScript estricto.
- expo-location + expo-task-manager (geocercas en segundo plano), expo-notifications, expo-secure-store, axios.
- react-native-maps 1.27.2 (Google Maps en Android, Apple Maps en iOS). Clave de Android en la variable de EAS `GOOGLE_MAPS_ANDROID_API_KEY`, inyectada por `app.config.ts`.
- Diseño: react-native-svg, expo-font (Barlow Condensed y Public Sans incrustadas), lucide-react-native, @react-native-community/slider.
- Pruebas: vitest para la lógica pura (con módulos de Expo simulados).
- Builds con EAS (cuenta `danielmcam`, proyecto `@danielmcam/geocheck`). Paquete `com.cliche.geocheck`. Perfiles: `development` (con Metro), `preview`, `production` y `spike` (solo el laboratorio de geocercas, con el JS embebido).

**Entorno del desarrollador:** Windows (PowerShell), Docker Desktop con WSL, teléfono de pruebas Xiaomi Redmi Note 10 Pro (Android 13, MIUI 14).

## Estructura del repositorio
- `backend/src/`: `app.ts`, `config.ts`, `db.ts`, `errors.ts`, `middleware/auth.ts`, `routes/` (auth, invitations, projects, timeEntries, places), `services/`, `utils/`.
- `backend/prisma/`: schema y migraciones. `backend/tests/`.
- `mobile/App.tsx`, `app.json`, `app.config.ts`, `eas.json`.
- `mobile/src/design/` (sistema de diseño), `src/texts/es.ts` (todos los textos), `src/navigation/` (pestañas por rol), `src/screens/`, `src/services/`, `src/projects/`, `src/components/`, `src/spike/` (laboratorio de geocercas, congelado).
- `docs/`: `plan-de-rebanadas.md`, `spike-geofencing.md`, `spike-resultado.md`. `docs/referencias/` (capturas de Supercrew) está en .gitignore y no se sube.
- Raíz: `README.md`, `User_Stories.md`, `Analisis_Requisitos_ConstructionClock.md`.

## Modelo de datos actual
- **Organization**, **User** (rol ADMIN / SUPERVISOR / EMPLOYEE / BOOKKEEPER), **Invitation**, **Project** (latitud, longitud, radio de 100 a 1000 m, por defecto 150, archived), **TimeEntry** (tipo AUTO / MANUAL / DELEGATED, clockIn, clockOut, editedBy, editedAt).
- Índice único parcial: un usuario solo puede tener **un** fichaje abierto.
- La identidad y la organización salen siempre del token, nunca del body. Un recurso de otra organización responde 404.

## Estado (a la fecha de este documento)
- Hecho: rebanada 0 (cuentas, organizaciones, invitaciones, roles), spike de geocercas (viable), rebanada 1 (obras con mapa, búsqueda y autocompletado), D0 (base visual) y D1 (pestañas por rol y "Más").
- Siguiente según el plan revisado: D2 → 1b → D3 → D4 → D5 → D6 → 2 → R → W → 3 → 5 (ver decisiones.md).

## Reglas de negocio

### Cuentas y roles
- Solo se crea una organización registrándose como dueño; quien la crea es **Administrador**.
- El administrador invita con un código y elige el rol (empleado, supervisor o contador). Nadie se asigna el rol de administrador.
- **El administrador también ficha**: necesita saber cuánto tiempo dedica a sus obras para asignarse su sueldo. Sus horas salen en los reportes como las de cualquiera.
- El contador no ficha: solo lectura.
- Pestañas: administrador y supervisor (Inicio, Obras, Registros, Equipo, Más); empleado (sin Equipo); contador (Obras, Registros, Más).

### Obras
- Radio de la geocerca: mínimo 100 m, máximo 1000 m, por defecto 150 m.
- El dueño da de alta las obras desde el teléfono: búsqueda por dirección con autocompletado, mapa con el círculo del radio y aviso si se encima con otra obra.
- Las obras duran días. Los empleados le avisan al dueño cuando terminan y **él** la marca como **Terminada** (hoy existe "Archivar"; pasará a En curso / Terminada). Una obra terminada deja de vigilarse y no admite fichajes.
- El dueño **asigna** empleados a cada obra. Un empleado puede estar en varias obras el mismo día (medidas, fotos, encargos).
- **Pendiente:** si el teléfono vigila solo las obras asignadas (opción 1) o todas las activas, con las no asignadas como "por revisar" (opción 2, recomendada).

### Tiempo pagado
- Se paga **desde que llega a la obra**, no desde que sale de su casa ni desde la hora a la que se le citó. La hora de la geocerca es la prueba objetiva.
- **No hay horarios de empleados** (se eliminaron del plan).
- **Jornada:** de la primera llegada a una obra a la última salida del día. No se paga de la casa a la primera obra ni de la última obra a la casa.
- Dentro de la jornada, si el dueño manda a alguien a otro lugar (aunque no sea una obra registrada), se pagan la ida, la estancia y el regreso.
- **El empleado no corrige sus horas ni aclara nada en la app.** El sistema marca lo dudoso; el dueño lo resuelve, normalmente preguntándole en persona.
- **Lo dudoso no se paga hasta que el dueño lo apruebe.** Toda decisión queda registrada (quién, cuándo, qué cambió, por qué).
- El empleado puede ver sus propias horas en solo lectura.
- Fichaje manual: solo con la hora del momento (no puede elegir una hora pasada); si el GPS no lo ubica dentro de la obra, queda "por revisar".
- Casos que se marcan "por revisar": hueco largo fuera de obra en plena jornada, jornada que termina lejos de una obra tras un encargo, entrada en obra no asignada, entrada sin salida, entradas en horas o días poco comunes o muy cortas, GPS impreciso o rebotes, ubicación desactivada durante la jornada, fichaje manual o delegado, inicio de sesión desde otro teléfono.
- Entrada sin salida: se paga solo hasta la última vez que el sistema confirmó que estaba en la obra.
- Límite conocido: no se puede detectar que alguien deje el teléfono en la obra y se vaya.
- **Comida — Pendiente:** se está preguntando al cliente si comen en la obra o salen, si se paga y cómo lo controla hoy. El descuento automático de 30 min no está confirmado.
- Reglas de nómina configurables por el administrador, sin reglas legales fijas en el código (inicio de semana, horas extra semanales con 40 h por defecto y umbral diario opcional, comida, límite de traslado automático).

### Equipo
- El dueño necesita una lista de su gente: nombre, rol, teléfono, si está en obra, horas de la semana; ficha por persona con obras asignadas, teléfono vinculado y, opcionalmente, pago por hora; acciones de cambiar rol, dar de baja (conserva historial), restablecer contraseña e invitar.
- Los trabajadores inician sesión una vez y la sesión no debe caducar; si olvidan la contraseña, la restablece el dueño.

### Preguntas pendientes al cliente
Comida (si comen en la obra o salen, si se paga, cuánto dura, cómo lo controla); si les dice a qué hora terminan o terminan al acabar el trabajo; quién decide la salida; si paga por hora y quiere ver lo que debe a cada uno; qué traslado entre obras le parece normal y cuál sospechoso; si tiene supervisores; si prefiere asignar en la app o que la app detecte la obra no asignada y él apruebe.