# TimeTrack App — Esqueleto del proyecto

App de control de horas por geofencing para construcción (alternativa a ConstructionClock).
Basado en `Analisis_Requisitos_ConstructionClock.md` y `User_Stories.md`.

## Estructura

```
timetrack-app/
├── backend/          Node.js + Express + TypeScript + Prisma (PostgreSQL/PostGIS)
│   ├── prisma/schema.prisma   Modelo de datos completo
│   └── src/
│       ├── routes/            Endpoints REST (projects, time-entries)
│       ├── services/          Lógica de negocio (clock-in/out, geofencing)
│       └── utils/geofence.ts  Cálculo de distancia haversine
└── mobile/           React Native (Expo)
    └── src/
        ├── screens/ClockScreen.tsx      Pantalla de fichaje del empleado
        └── services/geofenceService.ts  Geofencing en segundo plano
```

## Cómo arrancar

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tu DATABASE_URL real y un JWT_SECRET propio
npx prisma migrate dev --name init
npm run dev
```

Necesitas una base de datos PostgreSQL con la extensión PostGIS habilitada.
Localmente: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pass postgis/postgis`
En producción (barato): Railway o Supabase ya ofrecen PostGIS integrado.

### 2. Mobile

```bash
cd mobile
npm install
npx expo start
```

Escanea el QR con la app Expo Go en tu teléfono (Android o iOS) para probar sin necesidad de compilar nativo.

## Qué ya está implementado (MVP, fase 1)

- Modelo de datos completo (`schema.prisma`)
- Clock-in/out automático por geofence + manual (`timeEntryService.ts`, `ClockScreen.tsx`)
- Fichaje delegado por supervisor (`delegatedClockIn`)
- Edición de horas con auditoría (`editTimeEntry`)
- Creación de proyectos con geofence configurable (`routes/projects.ts`)
- Geofencing nativo en segundo plano, bajo consumo de batería (`geofenceService.ts`)

## Qué falta (siguiente sprint)

- Autenticación (login, invitaciones — RF-31, RF-32)
- Pantalla de mapa en vivo del supervisor
- Pantalla de timesheets/reportes del admin + exportación XLSX/PDF (RF-24)
- Modo offline con sincronización diferida (RNF-05)
- Cálculo de horas extra (RF-13)
- Pausas/almuerzo (RF-09, RF-27)

## Referencia

Ver `Analisis_Requisitos_ConstructionClock.md` para la lista completa de RF/RNF,
y `User_Stories.md` para las historias de usuario con prioridad MVP/Fase 2.
