import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../errors";
import { authenticate, currentUser } from "../middleware/auth";
import { joinOrganization, login, registerOrganization } from "../services/authService";

const email = z
  .string({ required_error: "El correo electrónico es obligatorio" })
  .trim()
  .toLowerCase()
  .email("Correo electrónico inválido");

const password = z
  .string({ required_error: "La contraseña es obligatoria" })
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede pasar de 72 caracteres"); // bcrypt ignora lo que pase de 72 bytes

const name = z.string({ required_error: "El nombre es obligatorio" }).trim().min(1, "El nombre es obligatorio").max(120);

const registerOrganizationSchema = z.object({
  organizationName: z
    .string({ required_error: "El nombre de la organización es obligatorio" })
    .trim()
    .min(1, "El nombre de la organización es obligatorio")
    .max(120),
  name,
  email,
  password,
});

// En login no se aplican las reglas de contraseña nueva: solo que venga algo.
const loginSchema = z.object({
  email,
  password: z.string({ required_error: "La contraseña es obligatoria" }).min(1, "La contraseña es obligatoria"),
});

const joinSchema = z.object({
  code: z.string({ required_error: "El código es obligatorio" }).trim().min(1, "El código es obligatorio").max(32),
  name,
  email,
  password,
});

export function createAuthRouter(options: { rateLimitMax: number }): Router {
  const router = Router();

  // Freno a la fuerza bruta (contraseñas, códigos de invitación). Cuenta solo las respuestas de error:
  // una cuadrilla entera uniéndose desde el mismo wifi (o la misma IP del operador) no se bloquea entre sí.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: options.rateLimitMax,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." },
  });

  router.post(
    "/register-organization",
    limiter,
    asyncHandler(async (req, res) => {
      const body = registerOrganizationSchema.parse(req.body);
      res.status(201).json(await registerOrganization(body));
    })
  );

  router.post(
    "/login",
    limiter,
    asyncHandler(async (req, res) => {
      const body = loginSchema.parse(req.body);
      res.json(await login(body));
    })
  );

  router.post(
    "/join",
    limiter,
    asyncHandler(async (req, res) => {
      const body = joinSchema.parse(req.body);
      res.status(201).json(await joinOrganization(body));
    })
  );

  router.get("/me", authenticate, (req, res) => {
    res.json({ user: currentUser(req) });
  });

  return router;
}
