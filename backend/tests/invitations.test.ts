import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { app, bearer, createInvitation, joinWithCode, PASSWORD, registerOrg, uniq, makeOrg } from "./helpers";

const CODE_FORMAT = /^[A-HJKMNP-Z2-9]{8}$/; // 8 caracteres, sin I, L, O, 0, 1
const DAY_MS = 86_400_000;

describe("POST /invitations", () => {
  it("genera un código de 8 caracteres, rol EMPLOYEE y 7 días por defecto", async () => {
    const admin = await registerOrg();
    const invitation = await createInvitation(admin.token);

    expect(invitation.code).toMatch(CODE_FORMAT);
    expect(invitation.role).toBe("EMPLOYEE");
    expect(invitation.status).toBe("active");
    expect(invitation.joinedCount).toBe(0);
    const remaining = new Date(invitation.expiresAt).getTime() - Date.now();
    expect(Math.abs(remaining - 7 * DAY_MS)).toBeLessThan(60_000);
  });

  it("permite elegir rol (SUPERVISOR, BOOKKEEPER) y duración de 1 a 30 días", async () => {
    const admin = await registerOrg();
    const supervisor = await createInvitation(admin.token, { role: "SUPERVISOR", expiresInDays: 30 });
    const bookkeeper = await createInvitation(admin.token, { role: "BOOKKEEPER", expiresInDays: 1 });

    expect(supervisor.role).toBe("SUPERVISOR");
    expect(bookkeeper.role).toBe("BOOKKEEPER");
    expect(new Date(supervisor.expiresAt).getTime() - Date.now()).toBeGreaterThan(29 * DAY_MS);
    expect(new Date(bookkeeper.expiresAt).getTime() - Date.now()).toBeLessThan(2 * DAY_MS);
  });

  it("rechaza el rol ADMIN con 400", async () => {
    const admin = await registerOrg();
    const res = await request(app).post("/invitations").set(bearer(admin.token)).send({ role: "ADMIN" }).expect(400);
    expect(res.body.error).toMatch(/rol no permitido/i);
  });

  it.each([0, 31, 1.5, "7"])("rechaza expiresInDays=%s con 400", async (expiresInDays) => {
    const admin = await registerOrg();
    await request(app).post("/invitations").set(bearer(admin.token)).send({ expiresInDays }).expect(400);
  });

  it("genera códigos distintos en cada invitación", async () => {
    const admin = await registerOrg();
    const codes = await Promise.all(Array.from({ length: 5 }, () => createInvitation(admin.token)));
    expect(new Set(codes.map((c) => c.code)).size).toBe(5);
  });
});

describe("GET /invitations y DELETE /invitations/:id", () => {
  it("lista las invitaciones de la organización con su estado y cuántas personas se unieron", async () => {
    const admin = await registerOrg();
    const invitation = await createInvitation(admin.token);
    await joinWithCode(invitation.code);
    await joinWithCode(invitation.code);
    const other = await createInvitation(admin.token);

    const res = await request(app).get("/invitations").set(bearer(admin.token)).expect(200);
    const byId = Object.fromEntries(res.body.map((i: { id: string }) => [i.id, i]));

    expect(res.body).toHaveLength(2);
    expect(byId[invitation.id]).toMatchObject({ code: invitation.code, status: "active", joinedCount: 2 });
    expect(byId[other.id]).toMatchObject({ status: "active", joinedCount: 0 });
  });

  it("marca como expirada una invitación vencida", async () => {
    const admin = await registerOrg();
    const invitation = await createInvitation(admin.token);
    await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get("/invitations").set(bearer(admin.token)).expect(200);
    expect(res.body[0].status).toBe("expired");
  });

  it("revoca una invitación (idempotente) y deja de servir para unirse", async () => {
    const admin = await registerOrg();
    const invitation = await createInvitation(admin.token);

    const first = await request(app).delete(`/invitations/${invitation.id}`).set(bearer(admin.token)).expect(200);
    const second = await request(app).delete(`/invitations/${invitation.id}`).set(bearer(admin.token)).expect(200);
    expect(first.body.status).toBe("revoked");
    expect(second.body.revokedAt).toBe(first.body.revokedAt);

    await request(app)
      .post("/auth/join")
      .send({ code: invitation.code, name: "Tarde", email: `tarde-${uniq()}@test.com`, password: PASSWORD })
      .expect(400);
  });

  it("revocar no expulsa a quien ya se unió", async () => {
    const admin = await registerOrg();
    const invitation = await createInvitation(admin.token);
    const member = await joinWithCode(invitation.code);
    await request(app).delete(`/invitations/${invitation.id}`).set(bearer(admin.token)).expect(200);

    await request(app).get("/auth/me").set(bearer(member.token)).expect(200);
  });

  it("responde 404 para un id inexistente y 400 para un id mal formado", async () => {
    const admin = await registerOrg();
    await request(app).delete("/invitations/00000000-0000-4000-8000-000000000000").set(bearer(admin.token)).expect(404);
    await request(app).delete("/invitations/no-es-uuid").set(bearer(admin.token)).expect(400);
  });
});

describe("POST /auth/join", () => {
  it("crea al usuario en la organización y con el rol de la invitación", async () => {
    const admin = await registerOrg();
    const invitation = await createInvitation(admin.token, { role: "SUPERVISOR" });
    const member = await joinWithCode(invitation.code);

    expect(member.user.role).toBe("SUPERVISOR");
    expect(member.user.organizationId).toBe(admin.user.organizationId);
    expect(member.user.organization.name).toBe(admin.user.organization.name);
    await request(app).get("/auth/me").set(bearer(member.token)).expect(200);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: member.user.id } });
    expect(stored.invitationId).toBe(invitation.id);
  });

  it("acepta el código en minúsculas y con guiones o espacios", async () => {
    const admin = await registerOrg();
    const { code } = await createInvitation(admin.token);
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
    await joinWithCode(typed);
    await joinWithCode(` ${code.slice(0, 4)} ${code.slice(4)} `);
  });

  it("el código sirve para varias personas hasta que expira o se revoca", async () => {
    const admin = await registerOrg();
    const { code } = await createInvitation(admin.token);
    const results = await Promise.all([joinWithCode(code), joinWithCode(code), joinWithCode(code)]);
    expect(new Set(results.map((r) => r.user.id)).size).toBe(3);
  });

  it("rechaza con el mismo mensaje un código inexistente, expirado o revocado", async () => {
    const admin = await registerOrg();
    const expired = await createInvitation(admin.token);
    await prisma.invitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const revoked = await createInvitation(admin.token);
    await request(app).delete(`/invitations/${revoked.id}`).set(bearer(admin.token)).expect(200);

    const join = (code: string) =>
      request(app).post("/auth/join").send({ code, name: "X", email: `x-${uniq()}@test.com`, password: PASSWORD }).expect(400);

    const bodies = await Promise.all([join("ZZZZZZZZ"), join(expired.code), join(revoked.code)]);
    expect(bodies[0].body.error).toMatch(/inválido, expirado o revocado/i);
    expect(bodies[1].body).toEqual(bodies[0].body);
    expect(bodies[2].body).toEqual(bodies[0].body);
  });

  it("rechaza con 409 un correo que ya tiene cuenta", async () => {
    const admin = await registerOrg();
    const { code } = await createInvitation(admin.token);
    await request(app)
      .post("/auth/join")
      .send({ code, name: "Dup", email: admin.email, password: PASSWORD })
      .expect(409);
  });

  it("valida los datos del formulario", async () => {
    const admin = await registerOrg();
    const { code } = await createInvitation(admin.token);
    const res = await request(app).post("/auth/join").send({ code, name: "", email: "mal", password: "123" }).expect(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });
});

describe("permisos de invitaciones", () => {
  it("solo el ADMIN puede crear, listar y revocar (los demás reciben 403; sin token, 401)", async () => {
    const { admin, supervisor, employee, bookkeeper } = await makeOrg();
    const invitation = await createInvitation(admin.token);

    for (const member of [supervisor, employee, bookkeeper]) {
      await request(app).post("/invitations").set(bearer(member.token)).send({}).expect(403);
      await request(app).get("/invitations").set(bearer(member.token)).expect(403);
      await request(app).delete(`/invitations/${invitation.id}`).set(bearer(member.token)).expect(403);
    }

    await request(app).post("/invitations").send({}).expect(401);
    await request(app).get("/invitations").expect(401);
  });
});
