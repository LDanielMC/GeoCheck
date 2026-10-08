import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { asyncHandler, HttpError } from "../errors";
import { authenticate, currentUser, requireRole } from "../middleware/auth";
import type { PlacesService } from "../services/placesService";

const MIN_QUERY_LENGTH = 3;

const sessionToken = z
  .string({ required_error: "Falta la sesión de búsqueda" })
  .regex(/^[A-Za-z0-9_-]{8,36}$/, "Sesión de búsqueda inválida");

const autocompleteQuery = z.object({
  q: z.string({ required_error: "Escribe al menos 3 caracteres" }).trim().min(MIN_QUERY_LENGTH, `Escribe al menos ${MIN_QUERY_LENGTH} caracteres`).max(200, "La búsqueda admite hasta 200 caracteres"),
  session: sessionToken,
});

const detailsQuery = z.object({
  placeId: z.string({ required_error: "Falta el lugar" }).regex(/^[A-Za-z0-9_-]{10,400}$/, "Lugar inválido"),
  session: sessionToken,
});

export interface PlacesRouterOptions {
  /** Undefined = sin clave configurada: las rutas responden 503 y la app usa el buscador del teléfono. */
  service: PlacesService | undefined;
  perMinute: number;
  perDay: number;
}

// Autocompletado de direcciones con Google Places (API New) a través del servidor: la clave no sale de aquí.
// Solo el ADMIN (quien da de alta obras) y con límites por usuario, para que una cuenta con errores o mal usada no gaste
// la cuota gratis de Google. Los contadores están en memoria: valen para una sola instancia y se reinician con ella; el tope
// que de verdad manda es el de Google Cloud (README, «Autocompletado de direcciones»).
export function createPlacesRouter(options: PlacesRouterOptions): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  const limiter = (windowMs: number, limit: number, message: string) =>
    rateLimit({
      windowMs,
      limit,
      keyGenerator: (req) => currentUser(req).id,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: message },
    });
  router.use(
    limiter(60_000, options.perMinute, "Demasiadas búsquedas seguidas. Espera un momento."),
    limiter(24 * 60 * 60_000, options.perDay, "Llegaste al límite diario de sugerencias de direcciones. Usa el botón Buscar o toca el mapa.")
  );

  const requireService = (): PlacesService => {
    if (!options.service) throw new HttpError(503, "El autocompletado de direcciones no está configurado");
    return options.service;
  };

  router.get(
    "/autocomplete",
    asyncHandler(async (req, res) => {
      const { q, session } = autocompleteQuery.parse(req.query);
      res.json({ suggestions: await requireService().autocomplete(q, session) });
    })
  );

  router.get(
    "/details",
    asyncHandler(async (req, res) => {
      const { placeId, session } = detailsQuery.parse(req.query);
      res.json(await requireService().details(placeId, session));
    })
  );

  return router;
}
