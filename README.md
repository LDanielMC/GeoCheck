# GeoCheck

> **Estado del proyecto: En desarrollo.**

App de control de asistencia por geocercas para cuadrillas de trabajo en campo: cada obra se define con un punto en el mapa y un radio, y el teléfono del trabajador registra su entrada y su salida al cruzar ese perímetro, sin que tenga que abrir la app. El primer cliente es una empresa de pintura en EE. UU. con su equipo de pintores; el diseño es multi-organización para poder servir a cualquier empresa con personal en campo.

## Funcionalidades principales

- **Organizaciones y roles:** cada empresa es una organización aislada (multi-tenant) con roles administrador, supervisor, empleado y contador.
- **Registro y acceso:** alta de la organización con su administrador, inicio de sesión con JWT y unión por **código de invitación** (el código define el rol y la organización, con vigencia de 1 a 30 días).
- **Proyectos (obras):** creación, edición y archivado, con geocerca de 100 a 1000 m (150 m por defecto). La ubicación se fija con el GPS del teléfono, coordenadas, búsqueda de dirección con autocompletado (Google Places) o tocando el mapa.
- **Fichaje (API):** entrada y salida propias, fichaje delegado por un supervisor o administrador y corrección de horas. Un usuario no puede tener dos fichajes abiertos, y el fichaje automático se rechaza si las coordenadas quedan fuera del radio del proyecto.
- **Geofencing en segundo plano:** validado en un teléfono Android real con un laboratorio de pruebas incluido en la app (ver [Estado actual](#estado-actual)).
- **Interfaz en español** con sistema de diseño propio y navegación por pestañas según el rol.

## Estado actual

**Ya funciona**

- Backend: registro de organización, login, unión por invitación, gestión de invitaciones, proyectos (crear, listar, editar, archivar), autocompletado de direcciones y los endpoints de fichaje, con aislamiento por organización, permisos por rol, límite de intentos y pruebas de integración.
- App móvil: registro, login, unirse con código, invitaciones, proyectos con mapa y búsqueda de direcciones, y navegación por rol.
- Spike de geofencing: el geofencing nativo detectó entradas y salidas con la app cerrada y la pantalla bloqueada en el teléfono de pruebas; el resultado está en [docs/spike-resultado.md](docs/spike-resultado.md).

**Falta**

- Fichaje automático y manual desde la app: `mobile/src/services/geofenceService.ts` todavía llama a endpoints que no existen en el backend, y la pestaña de Registros (línea de tiempo y correcciones con motivo) es un marcador de posición.
- Filtro contra falsos positivos en los eventos de geocerca (requisito derivado del spike).
- Probar el mapa en un development build con la clave de Google Maps.
- Panel web mínimo: reportes, reglas de nómina (horas extra y comida), tiempo de traslado y exportación.
- Modo sin conexión y optimización de batería, y la vista de supervisor (quién está activo).
- Interfaz en inglés, despliegue del backend (Supabase está previsto, sin desplegar) y publicación en Google Play.

El orden de trabajo está en [docs/plan-de-rebanadas.md](docs/plan-de-rebanadas.md).

## Capturas

<!-- Agrega aquí tus imágenes, por ejemplo: ![Proyectos](docs/capturas/proyectos.png) -->

_Pendiente._

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20+ (probado con 24), Express 4.21, TypeScript 5.6, Zod 3, JWT (`jsonwebtoken` 9), bcryptjs, express-rate-limit 8 |
| Base de datos | PostgreSQL 16 con Prisma 5 (Docker en local; Supabase previsto para producción) |
| App móvil | Expo SDK 57, React Native 0.86, React 19.2, TypeScript, React Navigation 6, Axios |
| Ubicación y mapas | expo-location y expo-task-manager (geocercas en segundo plano), react-native-maps 1.27 (Google Maps en Android) |
| Servicios externos | Google Places API (New), llamada solo desde el backend |
| Builds | EAS (perfiles `development`, `preview`, `production` y `spike`) |
| Pruebas | Vitest 5, Supertest |

## Arquitectura

```
├── docker-compose.yml     PostgreSQL 16 local
├── backend/               API REST (Node.js + Express + TypeScript + Prisma)
│   ├── prisma/            schema.prisma y migraciones
│   ├── src/
│   │   ├── routes/        auth, invitations, projects, timeEntries, places
│   │   ├── services/      lógica de negocio
│   │   ├── middleware/    autenticación JWT y control por rol
│   │   ├── utils/         cálculo de distancia y geocerca, códigos de invitación
│   │   ├── config.ts      validación de variables de entorno (falla rápido al arrancar)
│   │   └── seed.ts        datos de demostración
│   └── tests/             pruebas de integración
├── mobile/                app React Native (Expo)
│   └── src/               pantallas, navegación por rol, sistema de diseño, servicios y laboratorio de geofencing
└── docs/                  plan de trabajo, resultado del spike y guía de desarrollo
```

- **Multi-tenant:** el usuario y su organización se toman del token, nunca del cuerpo de la petición; un recurso de otra organización responde 404.
- **Integridad del fichaje:** un índice único parcial en PostgreSQL impide dos entradas abiertas para el mismo usuario aunque lleguen dos peticiones a la vez.
- **Places desde el servidor:** la clave de Google solo existe en el backend, con límites por usuario; si falla, la app usa el geocodificador del teléfono.

## Instalación y ejecución

Requisitos: Node.js 20 o superior, Docker Desktop (en Windows requiere WSL2) y, para probar la app, un teléfono Android con [Expo Go](https://expo.dev/go).

### 1. Base de datos

```bash
docker compose up -d        # PostgreSQL 16 en localhost:5432 (usuario, clave y base: geocheck)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # apunta al PostgreSQL de Docker; el JWT_SECRET de ejemplo solo sirve en desarrollo
npx prisma migrate dev      # crea las tablas
npm run seed                # organización demo con administrador, supervisor y empleado
npm run dev                 # http://localhost:3000  (GET /health comprueba también la base)
```

Cuentas del seed (contraseña `Demo1234!`): `admin@demo.com`, `supervisor@demo.com` y `empleado@demo.com`.

Si Prisma indica que falta el cliente, ejecuta `npx prisma generate`. El servidor se niega a arrancar si falta `DATABASE_URL` o `JWT_SECRET`, si este tiene menos de 32 caracteres o si no puede conectar con la base.

**Variables de entorno del backend** (`backend/.env.example`)

| Variable | Uso |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Conexión a PostgreSQL; en Supabase, pooler de transacciones y de sesión respectivamente |
| `JWT_SECRET` | Mínimo 32 caracteres; el valor de ejemplo se rechaza con `NODE_ENV=production` |
| `PORT` | Puerto del servidor (3000 por defecto) |
| `TRUST_PROXY` | Número de proxies delante del servidor, para que el límite de intentos vea la IP real |
| `AUTH_RATE_LIMIT_MAX` | Intentos fallidos por minuto y por IP en registro, login y unión |
| `GOOGLE_PLACES_API_KEY` | Clave solo de servidor para el autocompletado; sin ella las rutas `/places` responden 503 |
| `PLACES_RATE_LIMIT_PER_MINUTE`, `PLACES_RATE_LIMIT_PER_DAY` | Límites por usuario del autocompletado |

### 3. App móvil

```bash
cd mobile
npm install
npm start                   # Metro para Expo Go; escanea el QR con la app Expo Go
```

El teléfono y la computadora deben estar en la misma red: la app deduce la IP del backend de la dirección de Metro (puerto 3000). Desde Expo Go funcionan registro, login, invitaciones y proyectos con búsqueda de direcciones. El **mapa** y el **geofencing en segundo plano** requieren un development build (`npm run build:dev:android`, con una cuenta de Expo y `eas-cli`); el mapa además necesita la variable `GOOGLE_MAPS_ANDROID_API_KEY` en EAS. Los builds `preview` y `production` necesitan `EXPO_PUBLIC_API_URL` con la URL del backend desplegado.

Pasos de EAS, claves de Google Maps y Places, laboratorio de geofencing y conexión a Supabase: [docs/guia-desarrollo.md](docs/guia-desarrollo.md).

## API

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/register-organization` | público | Crea la organización y su administrador |
| `POST /auth/login` | público | Devuelve `{ token, user }` |
| `POST /auth/join` | público | Se une con un código de invitación |
| `GET /auth/me` | autenticado | Usuario actual con su organización |
| `POST /invitations`, `GET /invitations`, `DELETE /invitations/:id` | administrador | Genera, lista y revoca códigos de invitación |
| `GET /places/autocomplete`, `GET /places/details` | administrador | Sugerencias de direcciones y coordenadas del lugar elegido |
| `POST /projects`, `PATCH /projects/:id` | administrador | Crea y edita proyectos (nombre, ubicación, radio, archivado) |
| `GET /projects`, `GET /projects/:id` | todos | Proyectos de la organización |
| `POST /time-entries/clock-in`, `POST /time-entries/:id/clock-out` | administrador, supervisor, empleado | Fichaje propio |
| `POST /time-entries/delegated-clock-in`, `PATCH /time-entries/:id` | administrador, supervisor | Fichar por otros y editar horas |

Autenticación: `Authorization: Bearer <token>`. Registro, login y unión limitan a 10 intentos fallidos por minuto y por IP.

## Pruebas

```bash
cd backend
npm test                    # Vitest + Supertest
npm run typecheck           # tsc --noEmit

cd ../mobile
npm test                    # Vitest sobre la lógica pura (con módulos de Expo simulados)
npm run typecheck
```

Las pruebas del backend usan una base **separada** (`geocheck_test`, en el mismo PostgreSQL de Docker): la crean y migran solas, y se niegan a correr contra una base cuyo nombre no termine en `_test`. Si `DATABASE_URL` no es local, define `TEST_DATABASE_URL`.

## Documentación

- [docs/guia-desarrollo.md](docs/guia-desarrollo.md): development build, Google Maps y Places, diseño y textos, Supabase.
- [docs/spike-geofencing.md](docs/spike-geofencing.md) y [docs/spike-resultado.md](docs/spike-resultado.md): validación del geofencing en un teléfono real.
- [docs/plan-de-rebanadas.md](docs/plan-de-rebanadas.md): orden de desarrollo.
- [Analisis_Requisitos_ConstructionClock.md](Analisis_Requisitos_ConstructionClock.md) y [User_Stories.md](User_Stories.md): requisitos e historias de usuario.
