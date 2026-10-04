import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors";
import { authenticate, currentUser, requireRole } from "../middleware/auth";
import { createInvitation, listInvitations, revokeInvitation } from "../services/invitationService";

const router = Router();

// Todo lo de invitaciones es solo para ADMIN.
router.use(authenticate, requireRole("ADMIN"));

const createInvitationSchema = z.object({
  // ADMIN no se puede otorgar por invitación: el único ADMIN inicial es quien crea la organización.
  role: z
    .enum(["EMPLOYEE", "SUPERVISOR", "BOOKKEEPER"], {
      errorMap: () => ({ message: "Rol no permitido en invitaciones" }),
    })
    .default("EMPLOYEE"),
  expiresInDays: z
    .number({ invalid_type_error: "expiresInDays debe ser un número" })
    .int("expiresInDays debe ser un entero")
    .min(1, "La invitación debe durar al menos 1 día")
    .max(30, "La invitación puede durar como máximo 30 días")
    .default(7),
});

const idSchema = z.string().uuid("Identificador inválido");

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createInvitationSchema.parse(req.body ?? {});
    res.status(201).json(await createInvitation(currentUser(req), body));
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listInvitations(currentUser(req)));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    res.json(await revokeInvitation(currentUser(req), id));
  })
);

export default router;
