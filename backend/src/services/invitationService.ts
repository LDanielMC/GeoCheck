import type { Invitation } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { generateInviteCode } from "../utils/inviteCode";
import { isUniqueViolation } from "../utils/prismaErrors";
import type { SessionUser } from "./authService";

export type InvitableRole = "EMPLOYEE" | "SUPERVISOR" | "BOOKKEEPER";
export type InvitationStatus = "active" | "expired" | "revoked";

const DAY_MS = 86_400_000;
const MAX_CODE_ATTEMPTS = 5;

function statusOf(invitation: Pick<Invitation, "revokedAt" | "expiresAt">, now = Date.now()): InvitationStatus {
  if (invitation.revokedAt) return "revoked";
  return invitation.expiresAt.getTime() <= now ? "expired" : "active";
}

function toDto(invitation: Invitation, joinedCount: number) {
  return {
    id: invitation.id,
    code: invitation.code,
    role: invitation.role,
    status: statusOf(invitation),
    expiresAt: invitation.expiresAt,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt,
    joinedCount,
  };
}

export async function createInvitation(actor: SessionUser, input: { role: InvitableRole; expiresInDays: number }) {
  const expiresAt = new Date(Date.now() + input.expiresInDays * DAY_MS);

  // Con ~8.5e11 combinaciones una colisión es casi imposible; reintentamos por si acaso.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const invitation = await prisma.invitation.create({
        data: {
          code: generateInviteCode(),
          role: input.role,
          expiresAt,
          organizationId: actor.organizationId,
          createdById: actor.id,
        },
      });
      return toDto(invitation, 0);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(500, "No se pudo generar un código único. Inténtalo de nuevo.");
}

export async function listInvitations(actor: SessionUser) {
  const invitations = await prisma.invitation.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });
  return invitations.map((invitation) => toDto(invitation, invitation._count.users));
}

// Revocar es idempotente: revocar una invitación ya revocada la devuelve tal cual.
export async function revokeInvitation(actor: SessionUser, invitationId: string) {
  const existing = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId: actor.organizationId },
  });
  if (!existing) throw new HttpError(404, "Invitación no encontrada");

  const invitation = existing.revokedAt
    ? existing
    : await prisma.invitation.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const joinedCount = await prisma.user.count({ where: { invitationId: invitation.id } });
  return toDto(invitation, joinedCount);
}
