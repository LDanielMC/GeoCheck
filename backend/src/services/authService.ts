import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Organization, User, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { getConfig } from "../config";
import { HttpError } from "../errors";
import { normalizeInviteCode } from "../utils/inviteCode";
import { isUniqueViolation } from "../utils/prismaErrors";

const BCRYPT_COST = 10;
const TOKEN_TTL = "7d";

export const INVALID_INVITE_MESSAGE = "Código de invitación inválido, expirado o revocado";
const EMAIL_TAKEN_MESSAGE = "Ya existe una cuenta con ese correo electrónico";

// Hash de relleno: el login tarda lo mismo exista o no el correo (evita enumerar cuentas por tiempo de respuesta).
const DUMMY_HASH = bcrypt.hashSync("no-es-una-contraseña-real", BCRYPT_COST);

// Lo que sabemos de quien hace la petición (nunca incluye el hash de la contraseña).
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organization: { id: string; name: string };
}

type UserWithOrganization = User & { organization: Pick<Organization, "id" | "name"> };

function toSessionUser(user: UserWithOrganization): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organization: { id: user.organization.id, name: user.organization.name },
  };
}

function signToken(userId: string): string {
  return jwt.sign({}, getConfig().JWT_SECRET, { subject: userId, expiresIn: TOKEN_TTL, algorithm: "HS256" });
}

function startSession(user: UserWithOrganization) {
  return { token: signToken(user.id), user: toSessionUser(user) };
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getConfig().JWT_SECRET, { algorithms: ["HS256"] });
    return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function registerOrganization(input: {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  try {
    // El create anidado es atómico: o se crean la organización y su ADMIN, o ninguno.
    const organization = await prisma.organization.create({
      data: {
        name: input.organizationName,
        users: { create: { name: input.name, email: input.email, passwordHash, role: "ADMIN" } },
      },
      include: { users: true },
    });
    return startSession({ ...organization.users[0], organization });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, EMAIL_TAKEN_MESSAGE);
    throw err;
  }
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { organization: true },
  });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, "Credenciales inválidas");
  return startSession(user);
}

export async function joinOrganization(input: { code: string; name: string; email: string; password: string }) {
  const invitation = await prisma.invitation.findUnique({
    where: { code: normalizeInviteCode(input.code) },
  });
  // Un mismo mensaje para inexistente, expirado o revocado: no revela qué códigos existieron.
  // El rol ADMIN nunca debería llegar aquí (la API no lo permite al crear); se rechaza por si acaso.
  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.expiresAt.getTime() <= Date.now() ||
    invitation.role === "ADMIN"
  ) {
    throw new HttpError(400, INVALID_INVITE_MESSAGE);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: invitation.role,
        organizationId: invitation.organizationId,
        invitationId: invitation.id,
      },
      include: { organization: true },
    });
    return startSession(user);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, EMAIL_TAKEN_MESSAGE);
    throw err;
  }
}
