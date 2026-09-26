import { PrismaClient, TimeEntryType } from "@prisma/client";
import { isInsideGeofence } from "../utils/geofence";

const prisma = new PrismaClient();

// RF-03: clock-in automático al detectar entrada al geofence
export async function clockIn(params: {
  userId: string;
  projectId: string;
  lat: number;
  lon: number;
  type?: TimeEntryType;
}) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
  });

  if (
    params.type !== "MANUAL" &&
    !isInsideGeofence(params.lat, params.lon, project.latitude, project.longitude, project.geofenceRadius)
  ) {
    throw new Error("Fuera del radio del proyecto — no se puede fichar automáticamente");
  }

  // Evitar doble clock-in: cerrar cualquier entrada abierta del mismo usuario
  const openEntry = await prisma.timeEntry.findFirst({
    where: { userId: params.userId, clockOut: null },
  });
  if (openEntry) {
    throw new Error("Ya existe una entrada activa. Registra la salida antes de un nuevo ingreso.");
  }

  return prisma.timeEntry.create({
    data: {
      userId: params.userId,
      projectId: params.projectId,
      type: params.type ?? "AUTO",
      clockIn: new Date(),
    },
  });
}

// RF-04: clock-out automático al detectar salida del geofence
export async function clockOut(params: { timeEntryId: string }) {
  return prisma.timeEntry.update({
    where: { id: params.timeEntryId },
    data: { clockOut: new Date() },
  });
}

// RF-06: supervisor ficha en nombre de otro miembro de su cuadrilla
export async function delegatedClockIn(params: {
  supervisorId: string;
  targetUserId: string;
  projectId: string;
}) {
  const entry = await prisma.timeEntry.create({
    data: {
      userId: params.targetUserId,
      projectId: params.projectId,
      type: "DELEGATED",
      clockIn: new Date(),
      editedById: params.supervisorId,
      editedAt: new Date(),
    },
  });
  return entry;
}

// RF-08: edición manual con registro de auditoría
export async function editTimeEntry(params: {
  timeEntryId: string;
  editorId: string;
  clockIn?: Date;
  clockOut?: Date;
}) {
  return prisma.timeEntry.update({
    where: { id: params.timeEntryId },
    data: {
      clockIn: params.clockIn,
      clockOut: params.clockOut,
      editedById: params.editorId,
      editedAt: new Date(),
    },
  });
}
