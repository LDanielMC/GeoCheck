# GeoCheck — control de horas por geofencing para construcción

App **gratuita** de control de asistencia por geolocalización para cuadrillas de construcción
(alternativa a ConstructionClock). Basada en [Analisis_Requisitos_ConstructionClock.md](Analisis_Requisitos_ConstructionClock.md)
y [User_Stories.md](User_Stories.md).

## Estructura

```
├── docker-compose.yml     Postgres 16 local
├── backend/               Node.js + Express + TypeScript + Prisma (PostgreSQL)
│   ├── prisma/            schema.prisma y migraciones
│   ├── src/
│   │   ├── routes/        Endpoints REST (auth, invitations, projects, time-entries)
│   │   ├── services/      Lógica de negocio
│   │   ├── middleware/    authenticate + requireRole (JWT y roles)
│   │   ├── config.ts      Validación de variables de entorno (falla rápido)
│   │   └── seed.ts        Datos de demostración
│   └── tests/             Tests de integración (vitest + supertest)
└── mobile/                React Native (Expo SDK 57)
    ├── app.json           Permisos de ubicación en segundo plano, ids de la app
    ├── eas.json           Perfiles de build: development / preview / production
    └── src/               Pantallas, contexto de sesión y servicios
```

## Requisitos

- Node.js 20 o superior (probado con 24).
- Docker Desktop. **En Windows requiere WSL2**: en un PowerShell de administrador ejecuta `wsl --install`
  y reinicia. Sin WSL, Docker Desktop no arranca.
- Un teléfono Android con [Expo Go](https://expo.dev/go) para probar la app.

## Arranque

### 1. Base de datos

```bash
docker compose up -d        # Postgres 16 en localhost:5432 (usuario/clave/base: geocheck)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # ya apunta al Postgres de Docker; el JWT_SECRET de ejemplo solo sirve en desarrollo
npx prisma migrate dev      # crea las tablas
npm run seed                # organización demo con admin, supervisor y empleado
npm run dev                 # http://localhost:3000  (GET /health comprueba también la BD)
```

Cuentas del seed (contraseña `Demo1234!`): `admin@demo.com`, `supervisor@demo.com`, `empleado@demo.com`.

> npm 12 no ejecuta por defecto los scripts de instalación de las dependencias. Si Prisma se queja de
> que falta el cliente o el motor, ejecuta `npx prisma generate`.

El servidor se niega a arrancar (con un mensaje claro) si falta `DATABASE_URL` o `JWT_SECRET`, si este tiene
menos de 32 caracteres, o si no puede conectar con la base de datos.

### 3. App móvil (Expo Go)

```bash
cd mobile
npm install
npm start                   # abre Metro para Expo Go; escanea el QR con la app Expo Go
```

El teléfono y la PC deben estar en la misma red. La app deduce la IP del backend de la dirección de Metro
(puerto 3000). Si no conecta, permite Node.js en el firewall de Windows para redes privadas.

Desde Expo Go funcionan registro, login, unirse con código, invitaciones y proyectos (con el mapa y la búsqueda
por dirección). **El geofencing en segundo plano no funciona en Expo Go**: necesita un development build
(siguiente sección).

## Spike de geofencing

El laboratorio para validar el geofencing en un teléfono real (permisos, latencia, falsos positivos y batería)
está en `mobile/src/screens/GeofenceLabScreen.tsx`. Guía de campo, protocolo por escenario y criterios:
**[docs/spike-geofencing.md](docs/spike-geofencing.md)**. Resumen:

```bash
cd mobile
npm run build:spike:android   # APK release con el JS embebido (perfil "spike" de eas.json)
```

Las pruebas con la app cerrada deben hacerse con ese APK, **no** con el development build: este necesita Metro
para cargar el JS y, sin él, el evento de geocerca no tiene código que ejecutar. Hay que recompilarlo cada vez que
cambian las dependencias nativas (notificaciones, diálogo de batería, pantalla activa).

La lógica del spike se prueba sin teléfono: `cd mobile && npm test` (análisis del log, sesiones, marcadores y tareas en
segundo plano contra módulos de Expo simulados).

## Development build


El proyecto ya está preparado: `expo-dev-client`, permisos de ubicación en segundo plano en `app.json`
(plugin `expo-location`) y `eas.json` con el perfil `development`.

```bash
cd mobile
npm install -g eas-cli      # una sola vez
eas login                   # tu cuenta de Expo (gratuita)
eas init                    # enlaza el proyecto; escribe el projectId en app.json
npm run build:dev:android   # build en la nube (plan gratuito de EAS) → APK que instalas en el teléfono
npm run start:dev           # Metro para el development build
```

Identificadores: `com.cliche.geocheck` (Android e iOS).

Builds `preview` y `production` no tienen Metro: define la URL del backend desplegado como variable
`EXPO_PUBLIC_API_URL` (por ejemplo en `eas.json` → `build.<perfil>.env`). Si falta, la app muestra un error
claro en vez de intentar conectar a localhost.

Antes de publicar en Google Play hay que declarar el uso de ubicación en segundo plano (formulario de
permisos de la Play Console) y mostrar una explicación previa dentro de la app. Para pruebas internas
basta con subir el `.aab` (`production`) a la pista de pruebas internas.

**Pendiente antes de publicar:** el permiso `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (diálogo de exclusión de batería
del laboratorio del spike) está restringido por Google Play: o se justifica en la Play Console o se quita de
`mobile/app.json` y se guía al usuario a los ajustes de batería sin él. De paso, revisar el resto de permisos del
manifiesto generado.

## Mapa y búsqueda de direcciones

El formulario de proyecto fija la ubicación con un mapa (`react-native-maps`: Google Maps en Android, Apple Maps en iOS)
y busca direcciones con el geocodificador del propio teléfono (`expo-location`), sin cuenta, clave ni costo. En
**Expo Go funciona tal cual**. La búsqueda solo se lanza al pulsar «Buscar» y no autocompleta; si con direcciones reales
de EE. UU. no da buenos resultados, se cambia solo `searchAddress` (`mobile/src/services/addressSearch.ts`) por una
llamada al backend que use Google.

**Pendiente antes de publicar:** en un APK propio (development build, preview o production) el mapa de **Android** se ve en
blanco mientras no tenga una clave de Google Maps; el resto de la pantalla (búsqueda, coordenadas, GPS y «Abrir el punto
en la app de mapas») sigue funcionando. En iOS no hace falta clave. Cuando haga falta, la cuenta de Google la crea la
agencia que publica la app:

1. Proyecto en Google Cloud con facturación activada y la API **Maps SDK for Android** habilitada.
2. Clave de API restringida a apps de Android: paquete `com.cliche.geocheck` y la huella SHA-1 del certificado con el que se
   firma la app (con Play App Signing, la que muestra la Play Console).
3. Añadir a `plugins` en `mobile/app.json`: `["react-native-maps", { "androidGoogleMapsApiKey": "<clave>" }]` y recompilar.

Costos verificados en la documentación oficial el 2026-10-08 (pueden cambiar): el SDK de mapas para móvil no tiene costo
por uso; la geocodificación de Google (solo si hay que cambiar de proveedor) incluye 10 000 solicitudes gratis al mes y
después cuesta 5 USD por cada 1000.

## Tests

```bash
cd backend
npm test                    # vitest + supertest
npm run typecheck           # tsc --noEmit
```

Los tests usan una base **separada** (`geocheck_test`, en el mismo Postgres de Docker): la crean y migran
solos, y se niegan a correr contra cualquier base cuyo nombre no termine en `_test`. Si `DATABASE_URL` no es
local (por ejemplo Supabase), define `TEST_DATABASE_URL` con una base de pruebas.

## Apuntar a Supabase

1. En `backend/.env`, comenta las URL de Docker y descomenta las de Supabase (ver `.env.example`):
   `DATABASE_URL` = pooler de transacciones (puerto 6543, con `?pgbouncer=true`) y
   `DIRECT_URL` = pooler de sesión o conexión directa (puerto 5432), que usan las migraciones.
2. La base debe estar vacía o reseteada (`npx prisma migrate reset`): el schema cambió respecto al primer esqueleto.
3. `npx prisma migrate deploy`.

## API (rebanadas 0 y 1)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/register-organization` | público | Crea la organización y su ADMIN |
| `POST /auth/login` | público | Devuelve `{ token, user }` |
| `POST /auth/join` | público | Se une con un código de invitación (rol y organización los define el código) |
| `GET /auth/me` | autenticado | Usuario actual con su organización |
| `POST /invitations` | ADMIN | Genera código (rol EMPLOYEE/SUPERVISOR/BOOKKEEPER, 1–30 días) |
| `GET /invitations` | ADMIN | Lista con estado y cuántas personas se unieron |
| `DELETE /invitations/:id` | ADMIN | Revoca el código |
| `POST /projects` | ADMIN | Crea un proyecto: nombre, ubicación y radio de la geocerca (100–1000 m, por defecto 150) |
| `GET /projects`, `GET /projects/:id` | todos | Proyectos de la organización, sin archivados (`?includeArchived=true` solo para ADMIN) |
| `PATCH /projects/:id` | ADMIN | Edita nombre, ubicación (latitud y longitud juntas), radio y `archived` (archivar o restaurar) |
| `POST /time-entries/clock-in`, `/:id/clock-out` | ADMIN, SUPERVISOR, EMPLOYEE | Fichaje propio |
| `POST /time-entries/delegated-clock-in`, `PATCH /time-entries/:id` | ADMIN, SUPERVISOR | Fichar por otros y editar horas |

Autenticación: `Authorization: Bearer <token>`. Quién actúa y a qué organización pertenece se toma del token
(nunca del body); un recurso de otra organización responde 404. `/auth/register-organization`, `/auth/login` y
`/auth/join` limitan a 10 intentos **fallidos** por minuto y por IP (`AUTH_RATE_LIMIT_MAX`).

## Estado

**Hecho:** rebanada 0 (base multi-tenant, auth con roles, invitaciones, tests, entorno Docker, app lista para
development build) y rebanada 1 (proyectos: crear, ver, editar y archivar, con radio mínimo de 100 m; la ubicación se
fija con el GPS del teléfono, coordenadas, buscando la dirección o tocando el mapa). Falta probar la rebanada 1 completa
en Expo Go, sobre todo la búsqueda con direcciones reales de EE. UU.

**Spike de geofencing:** resultado provisional en **[docs/spike-resultado.md](docs/spike-resultado.md)** (viable con
condiciones; falta medir el escenario 3, app deslizada de Recientes).

**Plan y orden:** **[docs/plan-de-rebanadas.md](docs/plan-de-rebanadas.md)** fija el orden **2 → W → 3 → 5**, dónde
entran las reglas de nómina (horas extra y comida configurables), el tiempo de traslado (US-24) y la corrección de horas
con motivo (US-09), y las preguntas que siguen abiertas.

**Siguiente:**
1. **Probar la rebanada 1 en Expo Go** y **escenario 3 del spike** (app deslizada de Recientes) con el APK actual.
2. Rebanada 2 (fichaje automático y manual), con los requisitos de [docs/spike-resultado.md](docs/spike-resultado.md):
   filtro contra rebotes, ignorar los eventos de re-registro, datos exactos de entrada y salida para el traslado.
3. **W: panel web mínimo** (reportes, reglas de nómina, corrección de horas, traslado y exportación). Su alcance exacto
   se aprueba antes de empezar.
4. Rebanada 3 (offline y batería) y 5 (supervisor: quién está activo, según los fichajes).

**Al recompilar el APK** (no antes): aplicar `shouldPlaySound: true` en `mobile/src/spike/labNotifications.ts`, actualizar
`expo` (57.0.27), `expo-constants` (57.0.21) y `expo-notifications` (57.0.22), y revisar en el teléfono el canal de
notificaciones (vibración, no molestar). Antes de publicar: la clave de Google Maps (sección anterior) y el permiso de
exclusión de batería.

Pendiente conocido: `mobile/src/services/geofenceService.ts` llama a endpoints que aún no existen
(`/time-entries/exit/:id`); el spike y la rebanada 2 definen el contrato real. `ClockScreen` es una maqueta
y todavía no se muestra en la app.
