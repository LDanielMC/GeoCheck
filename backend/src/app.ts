import express, { type Express } from "express";
import cors from "cors";
import { getConfig } from "./config";
import { prisma } from "./db";
import { errorHandler, notFoundHandler } from "./errors";
import { createAuthRouter } from "./routes/auth";
import invitationsRouter from "./routes/invitations";
import { createPlacesRouter } from "./routes/places";
import projectsRouter from "./routes/projects";
import timeEntriesRouter from "./routes/timeEntries";
import { createPlacesService, type FetchLike, type PlacesService } from "./services/placesService";

export interface AppOptions {
  /** Servicio de Places (por defecto, Google con GOOGLE_PLACES_API_KEY; sin clave, las rutas responden 503). Inyectable en tests. */
  placesService?: PlacesService;
  /** fetch que usa el servicio de Places por defecto. Inyectable en tests. */
  placesFetch?: FetchLike;
  /** Peticiones de autocompletado por usuario y por minuto / por día (por defecto, PLACES_RATE_LIMIT_PER_MINUTE / _DAY). */
  placesRateLimit?: { perMinute?: number; perDay?: number };
  /** Intentos fallidos por minuto y por IP en /auth (por defecto, AUTH_RATE_LIMIT_MAX). */
  authRateLimitMax?: number;
  /** Comprobación de la BD para /health (por defecto, un SELECT 1). Inyectable en tests. */
  checkDatabase?: () => Promise<unknown>;
}

// Separado de index.ts para poder levantar la app en los tests sin abrir un puerto.
export function createApp(options: AppOptions = {}): Express {
  const config = getConfig();
  const checkDatabase = options.checkDatabase ?? (() => prisma.$queryRaw`SELECT 1`);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "error", db: "down" });
    }
  });

  app.use("/auth", createAuthRouter({ rateLimitMax: options.authRateLimitMax ?? config.AUTH_RATE_LIMIT_MAX }));
  app.use("/invitations", invitationsRouter);
  app.use(
    "/places",
    createPlacesRouter({
      service: options.placesService ?? (config.GOOGLE_PLACES_API_KEY ? createPlacesService(config.GOOGLE_PLACES_API_KEY, options.placesFetch) : undefined),
      perMinute: options.placesRateLimit?.perMinute ?? config.PLACES_RATE_LIMIT_PER_MINUTE,
      perDay: options.placesRateLimit?.perDay ?? config.PLACES_RATE_LIMIT_PER_DAY,
    })
  );
  app.use("/projects", projectsRouter);
  app.use("/time-entries", timeEntriesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
