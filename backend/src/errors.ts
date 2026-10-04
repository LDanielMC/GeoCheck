import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

// Error con código HTTP y un mensaje seguro para mostrar al cliente.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Express 4 no captura promesas rechazadas en los handlers async: las reenviamos a next().
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
};

// Último middleware: nunca devuelve mensajes internos (Prisma, stack) al cliente.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    res.status(400).json({ error: details[0]?.message ?? "Datos inválidos", details });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Errores de body-parser: JSON mal formado o cuerpo demasiado grande.
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "El cuerpo de la petición es demasiado grande" });
    return;
  }

  // Red de seguridad para violaciones que ningún servicio tradujo a un mensaje propio.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Ya existe un registro con esos datos" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Registro no encontrado" });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
};
