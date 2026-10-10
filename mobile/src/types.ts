import { texts } from "./texts";

export type UserRole = "ADMIN" | "SUPERVISOR" | "EMPLOYEE" | "BOOKKEEPER";

// El ADMIN no se otorga por invitación: solo lo es quien crea la organización.
export type InvitableRole = Exclude<UserRole, "ADMIN">;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organization: { id: string; name: string };
}

export interface Session {
  token: string;
  user: SessionUser;
}

export type InvitationStatus = "active" | "expired" | "revoked";

export interface Invitation {
  id: string;
  code: string;
  role: InvitableRole;
  status: InvitationStatus;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  joinedCount: number;
}

// Los textos viven en src/texts; esto se conserva porque varias pantallas lo importan de aquí.
export const ROLE_LABELS: Record<UserRole, string> = texts.roles;

// Proyecto (obra) con su geocerca. Los límites del radio están en src/projects/rules.ts.
export interface Project {
  id: string;
  organizationId: string;
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  archived: boolean;
  createdAt: string;
}
