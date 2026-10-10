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

Desde Expo Go funcionan registro, login, unirse con código, invitaciones y proyectos, incluida la búsqueda por
dirección. **El mapa del selector de ubicación salió en blanco en el Expo Go del teléfono de pruebas** (2026-10-08, aunque
la documentación de Expo dice que no requiere configuración): necesita la clave de Google Maps de la sección «Mapa y
búsqueda de direcciones» y se prueba con un development build. **El geofencing en segundo plano tampoco funciona en
Expo Go**: necesita un development build (siguiente sección).

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

**Qué perfil compilar**
- `development`: la app completa (login, proyectos, mapa…) con el JS servido por Metro (`npm run start:dev`). Es el que se
  usa para probar el mapa.
- `spike`: **solo** el laboratorio de geofencing (no monta login, proyectos ni mapa; ver `App.tsx`), con el JS embebido.
  Es el único válido para el escenario 3 (app cerrada), porque el development build necesita Metro.
- Los dos usan el paquete `com.cliche.geocheck`, así que instalar uno **reemplaza** al otro en el teléfono: exporta antes el
  log del laboratorio si lo necesitas.
- Cada perfil de `eas.json` declara su `environment` (`development`, `preview`, `production`; `spike` hereda el de `preview`).
  De ahí salen las variables de EAS, como la clave de Google Maps de la sección siguiente.

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
y busca direcciones con **sugerencias de Google Places mientras se escribe**, a través del backend (apartado «Autocompletado
de direcciones»). Si el backend no tiene clave, no hay red o Google falla, la pantalla pasa sola al geocodificador del propio
teléfono (`expo-location`, sin cuenta, clave ni costo), que se usa al pulsar «Buscar» y no autocompleta. El mapa muestra el
punto azul de la ubicación del usuario, tiene un botón «Mi ubicación» y, en una obra nueva, abre centrado en la persona si
dio el permiso.

**El mapa de Android necesita una clave de Google Maps.** Sin ella se ve beige, con el logo de Google y sin calles. Le pasó
al Expo Go del teléfono de pruebas (2026-10-08), aunque
[la documentación de Expo](https://docs.expo.dev/versions/latest/sdk/map-view/) dice que no requiere configuración. El
resto de la pantalla (búsqueda, coordenadas, GPS, «Abrir el punto en la app de mapas») funciona igual. En iOS no hace falta
clave (Apple Maps). La cuenta de Google la crea la agencia que publica la app.

### 1. Proyecto y clave en Google Cloud

1. En [console.cloud.google.com](https://console.cloud.google.com), con la cuenta de la agencia: selector de proyectos ›
   **Create Project** (por ejemplo «GeoCheck»).
2. **Facturación.** Maps Platform exige un proyecto con cuenta de facturación y Google pide un método de pago para crearla
   (el Free Trial dice «you must provide a credit card or other payment method»). El SDK de mapas para móvil no se cobra por
   uso (tabla de precios verificada el 2026-10-08).
3. **APIs & Services › Library:** busca **Maps SDK for Android** y pulsa **Enable**. Solo esa API.
4. Saca la huella SHA-1 de la firma (apartado 2).
5. **APIs & Services › Credentials › Create credentials › API key.** En la ventana que aparece pulsa **Edit API key** (o abre
   la clave desde la lista) y configura:
   - **Application restrictions › Android apps › Add an item:** paquete `com.cliche.geocheck` y la huella SHA-1. Una entrada
     por cada SHA-1 distinta.
   - **API restrictions › Restrict key:** marca solo **Maps SDK for Android**.
   - **Save.** Puede tardar unos minutos en aplicarse.

   La clave acaba dentro del APK y cualquiera puede extraerla: por eso se restringe al paquete, a la firma y a esa única API
   (una clave así no sirve para otra app ni para APIs con cobro).

### 2. Huella SHA-1 de la firma de EAS

```bash
cd mobile
eas credentials --platform android
```

Elige el perfil (`development`). El comando **imprime primero** las credenciales de Android: copia la línea
**SHA1 Fingerprint** del bloque del keystore (junto a Key Alias, MD5 y SHA256) y sal del menú con **Exit** sin cambiar nada.
Repite con el perfil `spike`: EAS reutiliza el keystore de la app en las siguientes compilaciones, así que lo normal es que
la huella sea la misma; si no lo es, añade las dos a la clave. Sin terminal: expo.dev › el proyecto › Configure ›
Credentials › Application Identifiers › `com.cliche.geocheck` › Android Keystore › SHA-1 Certificate Fingerprint.

### 3. Clave en el proyecto, sin subirla al repositorio

`mobile/app.config.ts` parte de `app.json` y añade el plugin `react-native-maps` con la clave que lee de la variable de
entorno `GOOGLE_MAPS_ANDROID_API_KEY`; la clave no se escribe en ningún archivo del repositorio. Para las compilaciones de EAS:

```bash
cd mobile
eas env:set --name GOOGLE_MAPS_ANDROID_API_KEY --visibility sensitive --environment development --environment preview --environment production
```

Sin `--value`, el CLI pide el valor: pégalo ahí, para que no quede en el historial de la terminal. Alternativa: expo.dev › el
proyecto › Project settings › Environment variables › Add Variables. Se comprueba con `eas env:list --environment development`.
Se usa `sensitive` porque Expo pide al menos ese nivel cuando la configuración dinámica también se resuelve en local;
`secret` no añadiría seguridad, ya que la clave termina en el manifiesto del APK.

Una compilación de Android en la nube sin la variable **falla antes de compilar** con un mensaje que lo explica (el perfil
`spike` queda exento: solo monta el laboratorio). En local (por ejemplo `npx expo prebuild`) la variable se lee de un `.env`
ignorado por git, o se baja con `eas env:pull --environment development`.

### 4. Compilar y comprobar

```bash
cd mobile
npm run build:dev:android   # perfil development; instala el APK, luego npm run start:dev
```

Abre Proyectos › Nuevo proyecto › «Buscar dirección o elegir en el mapa». Si el mapa sigue beige, es un fallo de autorización
de la clave: revisa que **Maps SDK for Android** esté habilitada, que el paquete y la SHA-1 de la clave sean los de la app
instalada y que el proyecto tenga la facturación vinculada. Con adb, `adb logcat | findstr "Google Maps Android API"` suele
mostrar el motivo («Authorization failure»). Cambiar la clave exige recompilar.

### Antes de publicar en Google Play

Google vuelve a firmar con su propia clave lo que distribuye: añade a la clave de API **también** esa huella (Play Console ›
Test and release › App integrity › Play app signing › Settings › App signing key certificate › SHA-1 certificate
fingerprint; hace falta haber subido antes una versión). Sin ella, el mapa saldría en blanco en las instalaciones desde Play.

Costos verificados en la documentación oficial el 2026-10-08 (pueden cambiar): el SDK de mapas para móvil no tiene costo
por uso; el autocompletado de direcciones tiene su propio cobro (siguiente apartado).

## Autocompletado de direcciones (Google Places API New)

La app no habla con Google: llama a `GET /places/autocomplete` y `GET /places/details` del backend (solo ADMIN, con sesión),
y el backend llama a Google con una clave que **solo existe en el servidor** y es **distinta de la del mapa**. Sin
`GOOGLE_PLACES_API_KEY` esas rutas responden 503 y la app usa el buscador del teléfono.

**Costos** (<https://developers.google.com/maps/billing-and-pricing/pricing>, «Last updated 2026-10-07»; re-verificar antes
de decidir): Autocomplete Requests 10 000 gratis al mes y luego 2.83 USD por 1000; Autocomplete Session Usage ilimitado;
Place Details Essentials 10 000 gratis al mes y luego 5.00 USD por 1000. Dentro de una sesión (mismo token), las
peticiones de autocompletado desde la 13.ª no se cobran y la sesión termina en el Place Details. El backend pide solo
`location` y `formattedAddress` (Essentials); pedir un campo de otra categoría, como `displayName` (Pro), subiría el cobro de
toda la petición: hay una prueba que lo vigila. Con ~7 peticiones por dirección, la cuota gratis alcanza para unas 1 400
direcciones al mes. Fuera de ella, una dirección cuesta unos 0.025 USD.

### Crear la clave en Google Cloud (mismo proyecto que la del mapa)

1. **APIs & Services › Library:** busca **Places API (New)** y pulsa **Enable**. No habilites «Places API» (la antigua) ni
   Geocoding.
2. **APIs & Services › Credentials › Create credentials › API key.** Ábrela con **Edit API key** y ponle un nombre que la
   distinga (por ejemplo «GeoCheck Places (servidor)»):
   - **API restrictions › Restrict key:** marca solo **Places API (New)**.
   - **Application restrictions:** *None* mientras el hosting no tenga IP fija (Google recomienda la restricción por IP para
     claves de servidor, pero exige que coincida con la IP que ve Google). Cuando se elija el hosting se revisa si se puede.
   - **Save.** Puede tardar unos minutos.
3. **Tope diario.** **APIs & Services › Enabled APIs & services › Places API (New) › Quotas & System limits.** Busca la cuota de
   solicitudes de Autocomplete (si hay una «per day», esa; si solo hay «per minute», esa) y edítala. Para no pasar de la
   cuota gratis (10 000 al mes), un tope de unas **300 por día** deja 9 000 al mes. Súbelo cuando haga falta. Google avisa de
   que un tope bajo corta el servicio: la app seguiría con el buscador del teléfono. *No pude abrir la consola para confirmar
   los nombres exactos de cada cuota; si no los encuentras, dime lo que ves.*
4. **Alerta de presupuesto.** **Billing › Budgets & alerts › Create budget:** 5 USD al mes, con avisos al 50, 90 y 100 %.
   Un presupuesto **solo avisa**, no corta el gasto (lo dice Google); quien corta es el tope del paso 3.
5. **Dónde ponerla:** en `backend/.env` (que git ignora): `GOOGLE_PLACES_API_KEY=la_clave`, y reinicia el backend. En el
   hosting, como variable de entorno secreta con el mismo nombre. Nunca en `mobile/` ni en variables `EXPO_PUBLIC_*`.
6. **Comprobar** (con el backend en marcha y un ADMIN): `POST /auth/login`, y con el token
   `GET /places/autocomplete?q=1600 Pennsylvania&session=<uuid>`. Debe devolver sugerencias.

Si la clave se filtra, bórrala en Credentials y crea otra: no tiene efecto en la app compilada.

**Límites en el backend** (por usuario, en memoria, valen para una sola instancia): `PLACES_RATE_LIMIT_PER_MINUTE` (60) y
`PLACES_RATE_LIMIT_PER_DAY` (300). Responden 429 y la app pasa al buscador del teléfono.

## Diseño y textos (rebanada D)

- **`mobile/src/design/`** es el sistema de diseño de GeoCheck: colores, escala tipográfica y medidas (`tokens.ts`), íconos
  (`Icon.tsx`, Lucide, licencia ISC), el símbolo de la marca (`BrandMark.tsx`) y las piezas (botones, campos, chips, tarjetas,
  avisos, hoja inferior, pantalla vacía, filas de lista). Las pantallas importan de `src/design`. `src/ui.tsx` es el diseño
  anterior: lo usan el laboratorio del spike y las pantallas que aún no se migran, y desaparece de la app al terminar la D.
- **Tipografías:** Barlow Condensed (títulos y números) y Public Sans (texto), de los paquetes `@expo-google-fonts`
  (licencia libre). Viajan **dentro de la app** con el plugin `expo-font` de `app.json`, así que hace falta un development
  build nuevo para verlas; en Expo Go se vería la letra del sistema. Android usa el nombre del archivo como familia; iOS, el
  nombre PostScript (`src/design/fontFaces.ts`; una prueba comprueba que coincidan con `app.json` y con los archivos).
- **Textos:** todos los textos de la interfaz van en `mobile/src/texts/es.ts`; las pantallas importan `texts` y no escriben
  frases propias (`format()` para datos, `plural()` para cantidades). Cuando llegue el inglés (US-23) se añadirá un archivo
  hermano. Las pantallas se migran al rediseñarse.
- **Galería de la base visual** (solo para comprobar el diseño en el teléfono, con el development build instalado):

  ```powershell
  cd mobile
  $env:EXPO_PUBLIC_DESIGN_GALLERY = "1"; npx expo start --dev-client --clear
  ```

  Abre la app y muestra colores, letra, íconos y piezas. Sin esa variable, la app arranca normal.

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
| `GET /places/autocomplete`, `GET /places/details` | ADMIN | Sugerencias de direcciones y coordenadas del lugar elegido (Google Places, con límites por usuario; 503 sin clave) |
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
fija con el GPS del teléfono, coordenadas, buscando la dirección o tocando el mapa). Falta probar la rebanada 1 completa:
la búsqueda con direcciones reales de EE. UU. (se puede en Expo Go) y el mapa (necesita el development build con la clave
de Google Maps).

**Spike de geofencing:** resultado provisional en **[docs/spike-resultado.md](docs/spike-resultado.md)** (viable con
condiciones; falta medir el escenario 3, app deslizada de Recientes).

**Plan y orden:** **[docs/plan-de-rebanadas.md](docs/plan-de-rebanadas.md)** fija el orden **2 → W → 3 → 5**, dónde
entran las reglas de nómina (horas extra y comida configurables), el tiempo de traslado (US-24) y la corrección de horas
con motivo (US-09), y las preguntas que siguen abiertas.

**Siguiente:**
1. **Clave de Google Maps y development build** (pasos en «Mapa y búsqueda de direcciones»), para probar el mapa y cerrar la
   rebanada 1. **Escenario 3 del spike** (app deslizada de Recientes) con el APK `spike` que ya está instalado.
2. Rebanada 2 (fichaje automático y manual), con los requisitos de [docs/spike-resultado.md](docs/spike-resultado.md):
   filtro contra rebotes, ignorar los eventos de re-registro, datos exactos de entrada y salida para el traslado.
3. **W: panel web mínimo** (reportes, reglas de nómina, corrección de horas, traslado y exportación). Su alcance exacto
   se aprueba antes de empezar.
4. Rebanada 3 (offline y batería) y 5 (supervisor: quién está activo, según los fichajes).

**Aplicado en el código, falta compilar** (2026-10-08): `shouldPlaySound: true` en `mobile/src/spike/labNotifications.ts` y
los parches `expo` 57.0.27, `expo-constants` 57.0.21 y `expo-notifications` 57.0.22. El arreglo de la vibración solo se nota
en el APK `spike`. Al instalarlo, revisar en el teléfono el canal de notificaciones (vibración, no molestar). Antes de
publicar: la huella de Play App Signing en la clave de Google Maps y el permiso de exclusión de batería.

Pendiente conocido: `mobile/src/services/geofenceService.ts` llama a endpoints que aún no existen
(`/time-entries/exit/:id`); el spike y la rebanada 2 definen el contrato real. `ClockScreen` es una maqueta
y todavía no se muestra en la app.
