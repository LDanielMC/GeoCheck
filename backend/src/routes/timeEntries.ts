import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors";
import { authenticate, currentUser, requireRole } from "../middleware/auth";
import { clockIn, clockOut, delegatedClockIn, editTimeEntry } from "../services/timeEntryService";

const router = Router();

router.use(authenticate);

// Quién ficha, de quién es la entrada y a qué organización pertenece salen del token y de la BD,
// nunca del body: userId, organizationId, supervisorId o editorId que lleguen se ignoran.
const uuid = (message: string) => z.string({ required_error: message }).uuid(message);

const clockInSchema = z
  .object({
    projectId: uuid("projectId inválido"),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    // DELEGATED solo se crea por /delegated-clock-in
    type: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  })
  .refine((body) => body.type === "MANUAL" || (body.lat !== undefined && body.lon !== undefined), {
    path: ["lat"],
    message: "El fichaje automático requiere lat y lon",
  });

const delegatedSchema = z.object({
  targetUserId: uuid("targetUserId inválido"),
  projectId: uuid("projectId inválido"),
});

const isoDate = z
  .string()
  .datetime({ offset: true, message: "Fecha inválida (usa formato ISO 8601)" })
  .transform((value) => new Date(value));

const editSchema = z
  .object({ clockIn: isoDate.optional(), clockOut: isoDate.optional() })
  .refine((body) => body.clockIn !== undefined || body.clockOut !== undefined, {
    message: "Indica clockIn, clockOut o ambos",
  });

const idSchema = z.string().uuid("Identificador inválido");

// BOOKKEEPER es solo lectura: no ficha.
const CAN_CLOCK = requireRole("ADMIN", "SUPERVISOR", "EMPLOYEE");
const IS_MANAGER = requireRole("ADMIN", "SUPERVISOR");

router.post(
  "/clock-in",
  CAN_CLOCK,
  asyncHandler(async (req, res) => {
    const body = clockInSchema.parse(req.body);
    res.status(201).json(await clockIn(currentUser(req), body));
  })
);

router.post(
  "/:id/clock-out",
  CAN_CLOCK,
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    res.json(await clockOut(currentUser(req), id));
  })
);

router.post(
  "/delegated-clock-in",
  IS_MANAGER,
  asyncHandler(async (req, res) => {
    const body = delegatedSchema.parse(req.body);
    res.status(201).json(await delegatedClockIn(currentUser(req), body));
  })
);

router.patch(
  "/:id",
  IS_MANAGER,
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = editSchema.parse(req.body);
    res.json(await editTimeEntry(currentUser(req), id, body));
  })
);

export default router;
