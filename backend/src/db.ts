import { PrismaClient } from "@prisma/client";

// Una sola instancia para toda la app (cada PrismaClient abre su propio pool de conexiones).
export const prisma = new PrismaClient();
