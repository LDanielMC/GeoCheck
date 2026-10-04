import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";

export const app = createApp();

export const PASSWORD = "Passw0rd!";
// Coordenadas del proyecto de prueba (el geofence de 120 m se centra aquí).
export const SITE = { latitude: 19.4284, longitude: -99.1677 };

export const uniq = () => randomUUID().replace(/-/g, "").slice(0, 10);
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export type MemberRole = "EMPLOYEE" | "SUPERVISOR" | "BOOKKEEPER";

export interface Account {
  token: string;
  email: string;
  user: { id: string; name: string; email: string; role: string; organizationId: string; organization: { id: string; name: string } };
}

export async function registerOrg(overrides: Record<string, unknown> = {}, target: Express = app): Promise<Account> {
  const id = uniq();
  const email = `admin-${id}@test.com`;
  const res = await request(target)
    .post("/auth/register-organization")
    .send({ organizationName: `Org ${id}`, name: `Admin ${id}`, email, password: PASSWORD, ...overrides })
    .expect(201);
  return { token: res.body.token, user: res.body.user, email };
}

export async function createInvitation(adminToken: string, body: Record<string, unknown> = {}) {
  const res = await request(app).post("/invitations").set(bearer(adminToken)).send(body).expect(201);
  return res.body as { id: string; code: string; role: string; status: string; expiresAt: string; joinedCount: number };
}

export async function joinWithCode(code: string, overrides: Record<string, unknown> = {}): Promise<Account> {
  const id = uniq();
  const email = `user-${id}@test.com`;
  const res = await request(app)
    .post("/auth/join")
    .send({ code, name: `User ${id}`, email, password: PASSWORD, ...overrides })
    .expect(201);
  return { token: res.body.token, user: res.body.user, email };
}

export async function addMember(admin: Account, role: MemberRole): Promise<Account> {
  const invitation = await createInvitation(admin.token, { role });
  return joinWithCode(invitation.code);
}

export async function createProject(adminToken: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/projects")
    .set(bearer(adminToken))
    .send({ name: `Obra ${uniq()}`, ...SITE, geofenceRadius: 120, ...overrides })
    .expect(201);
  return res.body as { id: string; organizationId: string; name: string };
}

// Una organización completa: un usuario de cada rol y un proyecto.
export async function makeOrg() {
  const admin = await registerOrg();
  const [supervisor, employee, bookkeeper] = await Promise.all([
    addMember(admin, "SUPERVISOR"),
    addMember(admin, "EMPLOYEE"),
    addMember(admin, "BOOKKEEPER"),
  ]);
  const project = await createProject(admin.token);
  return { admin, supervisor, employee, bookkeeper, project };
}

export async function clockInAt(token: string, projectId: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post("/time-entries/clock-in")
    .set(bearer(token))
    .send({ projectId, lat: SITE.latitude, lon: SITE.longitude, ...extra });
}
