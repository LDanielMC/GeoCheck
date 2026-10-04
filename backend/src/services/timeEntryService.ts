import type { TimeEntryType } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { isInsideGeofence } from "../utils/geofence";
import { isUniqueViolation } from "../utils/prismaErrors";
import type { SessionUser } from "./authService";

// Todas las funciones reciben a quien actúa (`actor`, sacado del token) y limitan lo que ven
// a su organización: un id de otra organización se comporta como si no existiera (404).

const OPEN_ENTRY_MESSAGE = "Ya existe una entrada activa. Registra la salida antes de un nuevo ingreso.";

function isManager(actor: SessionUser): boolean {
  return actor.role === "ADMIN" || actor.role === "SUPERVISOR";
}

async function findProject(actor: SessionUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId, archived: false },
  });
  if (!project) throw new HttpError(404, "Proyecto no encontrado");
  return project;
}

async function findEntry(actor: SessionUser, entryId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, user: { organizationId: actor.organizationId } },
  });
  if (!entry) throw new HttpError(404, "Entrada de tiempo no encontrada");
  return entry;
}

// RF-03 / RF-05: clock-in automático (dentro del geofence) o manual (sin exigir GPS)
export async function clockIn(
  actor: SessionUser,
  params: { projectId: string; lat?: number; lon?: number; type: Extract<TimeEntryType, "AUTO" | "MANUAL"> }
) {
  const project = await findProject(actor, params.projectId);

  if (
    params.type === "AUTO" &&
    !isInsideGeofence(params.lat!, params.lon!, project.latitude, project.longitude, project.geofenceRadius)
  ) {
    throw new HttpError(422, "Fuera del radio del proyecto — no se puede fichar automáticamente");
  }

  try {
    // El índice único parcial de la BD impide dos entradas abiertas aunque lleguen dos peticiones a la vez.
    return await prisma.timeEntry.create({
      data: { userId: actor.id, projectId: project.id, type: params.type, clockIn: new Date() },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, OPEN_ENTRY_MESSAGE);
    throw err;
  }
}

// RF-04: clock-out. Cada quien cierra la suya; SUPERVISOR y ADMIN pueden cerrar la de su organización.
export async function clockOut(actor: SessionUser, entryId: string) {
  const entry = await findEntry(actor, entryId);
  const isOwner = entry.userId === actor.id;
  if (!isOwner && !isManager(actor)) {
    throw new HttpError(403, "No puedes cerrar la entrada de otra persona");
  }

  const now = new Date();
  const result = await prisma.timeEntry.updateMany({
    where: { id: entry.id, clockOut: null },
    data: { clockOut: now, ...(isOwner ? {} : { editedById: actor.id, editedAt: now }) },
  });
  if (result.count === 0) throw new HttpError(409, "La entrada ya estaba cerrada");

  return prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } });
}

// RF-06: un supervisor ficha en nombre de alguien de su organización
export async function delegatedClockIn(actor: SessionUser, params: { targetUserId: string; projectId: string }) {
  const [project, target] = await Promise.all([
    findProject(actor, params.projectId),
    prisma.user.findFirst({ where: { id: params.targetUserId, organizationId: actor.organizationId } }),
  ]);
  if (!target) throw new HttpError(404, "Usuario no encontrado");

  const now = new Date();
  try {
    return await prisma.timeEntry.create({
      data: {
        userId: target.id,
        projectId: project.id,
        type: "DELEGATED",
        clockIn: now,
        editedById: actor.id,
        editedAt: now,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "Esa persona ya tiene una entrada activa");
    throw err;
  }
}

// RF-08: edición manual con registro de quién y cuándo
export async function editTimeEntry(actor: SessionUser, entryId: string, changes: { clockIn?: Date; clockOut?: Date }) {
  const entry = await findEntry(actor, entryId);

  const clockIn = changes.clockIn ?? entry.clockIn;
  const clockOut = changes.clockOut ?? entry.clockOut;
  if (clockOut && clockOut.getTime() < clockIn.getTime()) {
    throw new HttpError(400, "La salida no puede ser anterior a la entrada");
  }

  return prisma.timeEntry.update({
    where: { id: entry.id },
    data: { clockIn, clockOut, editedById: actor.id, editedAt: new Date() },
  });
}
