import type { Request, RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../errors";
import { verifyToken, type SessionUser } from "../services/authService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const SESSION_ERROR = "Sesión inválida o expirada";

// Valida el JWT y carga al usuario desde la BD en cada petición: el rol que cuenta es el actual,
// no el que tenía cuando se emitió el token, y un usuario borrado pierde el acceso al instante.
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "No autenticado");

  const userId = verifyToken(header.slice("Bearer ".length).trim());
  if (!userId) throw new HttpError(401, SESSION_ERROR);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!user) throw new HttpError(401, SESSION_ERROR);

  req.user = user;
  next();
});

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "No autenticado"));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "No tienes permiso para esta acción"));
    }
    next();
  };
}

// Para handlers montados detrás de `authenticate`: devuelve al usuario o falla con 401.
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, "No autenticado");
  return req.user;
}
