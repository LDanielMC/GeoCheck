import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../errors";
import { authenticate, currentUser, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// La organización sale del token, nunca del body: cualquier organizationId que llegue se ignora.
const createProjectSchema = z.object({
  name: z.string({ required_error: "El nombre es obligatorio" }).trim().min(1, "El nombre es obligatorio").max(120),
  latitude: z.number({ required_error: "La latitud es obligatoria" }).min(-90).max(90),
  longitude: z.number({ required_error: "La longitud es obligatoria" }).min(-180).max(180),
  geofenceRadius: z
    .number()
    .int("El radio debe ser un número entero de metros")
    .min(20, "El radio mínimo es 20 m")
    .max(1000, "El radio máximo es 1000 m")
    .default(120),
});

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: { ...body, organizationId: currentUser(req).organizationId },
    });
    res.status(201).json(project);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { organizationId: currentUser(req).organizationId, archived: false },
      orderBy: { name: "asc" },
    });
    res.json(projects);
  })
);

export default router;
