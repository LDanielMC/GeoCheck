import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, HttpError } from "../errors";
import { authenticate, currentUser, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// Radio de la geocerca. El mínimo sale del spike de geofencing (docs/spike-resultado.md): con un fix de ±100 m
// un radio de 100 m ya produjo un falso positivo, y por debajo la detección en segundo plano no es fiable.
export const MIN_GEOFENCE_RADIUS_M = 100;
export const MAX_GEOFENCE_RADIUS_M = 1000;
export const DEFAULT_GEOFENCE_RADIUS_M = 150;

const projectName = z.string({ required_error: "El nombre es obligatorio" }).trim().min(1, "El nombre es obligatorio").max(120, "El nombre admite hasta 120 caracteres");
const latitude = z.number({ required_error: "La latitud es obligatoria", invalid_type_error: "La latitud debe ser un número" }).min(-90, "Latitud fuera de rango").max(90, "Latitud fuera de rango");
const longitude = z.number({ required_error: "La longitud es obligatoria", invalid_type_error: "La longitud debe ser un número" }).min(-180, "Longitud fuera de rango").max(180, "Longitud fuera de rango");
const geofenceRadius = z
  .number({ invalid_type_error: "El radio debe ser un número" })
  .int("El radio debe ser un número entero de metros")
  .min(MIN_GEOFENCE_RADIUS_M, `El radio mínimo es ${MIN_GEOFENCE_RADIUS_M} m`)
  .max(MAX_GEOFENCE_RADIUS_M, `El radio máximo es ${MAX_GEOFENCE_RADIUS_M} m`);

// La organización sale del token, nunca del body: cualquier organizationId que llegue se ignora.
const createProjectSchema = z.object({
  name: projectName,
  latitude,
  longitude,
  geofenceRadius: geofenceRadius.default(DEFAULT_GEOFENCE_RADIUS_M),
});

// Edición parcial. Latitud y longitud van juntas: cambiar solo una movería el proyecto a un punto sin sentido.
const updateProjectSchema = z
  .object({
    name: projectName.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    geofenceRadius: geofenceRadius.optional(),
    archived: z.boolean({ invalid_type_error: "archived debe ser verdadero o falso" }).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Indica al menos un campo para actualizar",
  })
  .refine((body) => (body.latitude === undefined) === (body.longitude === undefined), {
    path: ["latitude"],
    message: "La latitud y la longitud se actualizan juntas",
  });

const idSchema = z.string().uuid("Identificador inválido");

// Los archivados solo los ve el ADMIN; para el resto es como si no existieran.
async function findProject(actor: ReturnType<typeof currentUser>, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, organizationId: actor.organizationId, ...(actor.role === "ADMIN" ? {} : { archived: false }) },
  });
  if (!project) throw new HttpError(404, "Proyecto no encontrado");
  return project;
}

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
    const actor = currentUser(req);
    const includeArchived = req.query.includeArchived === "true";
    if (includeArchived && actor.role !== "ADMIN") {
      throw new HttpError(403, "No tienes permiso para ver proyectos archivados");
    }
    const projects = await prisma.project.findMany({
      where: { organizationId: actor.organizationId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    });
    res.json(projects);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    res.json(await findProject(currentUser(req), id));
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = updateProjectSchema.parse(req.body);
    const actor = currentUser(req);
    await findProject(actor, id); // 404 si no existe o es de otra organización

    // La organización va también en el filtro de la escritura: nunca se toca un proyecto ajeno.
    const { count } = await prisma.project.updateMany({ where: { id, organizationId: actor.organizationId }, data: body });
    if (count === 0) throw new HttpError(404, "Proyecto no encontrado");
    res.json(await findProject(actor, id));
  })
);

export default router;
