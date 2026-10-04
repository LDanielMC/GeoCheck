import { Prisma } from "@prisma/client";

// P2002 = violación de restricción única (email repetido, código repetido, fichaje abierto duplicado...)
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
