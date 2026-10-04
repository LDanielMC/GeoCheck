import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { app, bearer, clockInAt, createInvitation, makeOrg, SITE } from "./helpers";

// Aislamiento entre organizaciones (multi-tenant): lo de otra organización se comporta como si no existiera.

describe("aislamiento entre organizaciones", () => {
  it("los proyectos de una organización no aparecen en otra", async () => {
    const a = await makeOrg();
    const b = await makeOrg();

    const listB = await request(app).get("/projects").set(bearer(b.employee.token)).expect(200);
    expect(listB.body.map((p: { id: string }) => p.id)).toEqual([b.project.id]);
    expect(listB.body.map((p: { id: string }) => p.id)).not.toContain(a.project.id);
  });

  it("no se puede fichar en un proyecto de otra organización (404)", async () => {
    const a = await makeOrg();
    const b = await makeOrg();

    const res = await clockInAt(b.employee.token, a.project.id);
    expect(res.status).toBe(404);
    expect(await prisma.timeEntry.count({ where: { userId: b.employee.user.id } })).toBe(0);
  });

  it("no se pueden ver ni revocar las invitaciones de otra organización", async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    const invitation = await createInvitation(a.admin.token);

    const listB = await request(app).get("/invitations").set(bearer(b.admin.token)).expect(200);
    expect(listB.body.map((i: { id: string }) => i.id)).not.toContain(invitation.id);
    expect(listB.body.map((i: { code: string }) => i.code)).not.toContain(invitation.code);
    await request(app).delete(`/invitations/${invitation.id}`).set(bearer(b.admin.token)).expect(404);

    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.revokedAt).toBeNull(); // sigue intacta
  });

  it("no se pueden cerrar, editar ni delegar entradas de otra organización (404)", async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    const entry = (await clockInAt(a.employee.token, a.project.id)).body;

    await request(app).post(`/time-entries/${entry.id}/clock-out`).set(bearer(b.supervisor.token)).expect(404);
    await request(app)
      .patch(`/time-entries/${entry.id}`)
      .set(bearer(b.supervisor.token))
      .send({ clockOut: new Date().toISOString() })
      .expect(404);
    // Usuario de A como destinatario, proyecto de B
    await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(b.supervisor.token))
      .send({ targetUserId: a.employee.user.id, projectId: b.project.id })
      .expect(404);
    // Usuario de B como destinatario, proyecto de A
    await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(b.supervisor.token))
      .send({ targetUserId: b.employee.user.id, projectId: a.project.id })
      .expect(404);

    const stored = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(stored.clockOut).toBeNull();
    expect(stored.editedById).toBeNull();
  });
});

describe("la identidad sale del token, no del body", () => {
  it("POST /projects ignora un organizationId del body", async () => {
    const a = await makeOrg();
    const b = await makeOrg();

    const res = await request(app)
      .post("/projects")
      .set(bearer(a.admin.token))
      .send({ name: "Intento", ...SITE, organizationId: b.admin.user.organizationId })
      .expect(201);

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.organizationId).toBe(a.admin.user.organizationId);
  });

  it("clock-in ignora un userId del body: el fichaje es de quien tiene el token", async () => {
    const { employee, supervisor, project } = await makeOrg();

    const res = await clockInAt(employee.token, project.id, { userId: supervisor.user.id });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(employee.user.id);
    expect(await prisma.timeEntry.count({ where: { userId: supervisor.user.id } })).toBe(0);
  });

  it("clock-in no acepta type DELEGATED desde el endpoint normal", async () => {
    const { employee, project } = await makeOrg();
    const res = await clockInAt(employee.token, project.id, { type: "DELEGATED" });
    expect(res.status).toBe(400);
  });

  it("el fichaje delegado y la edición registran como autor a quien tiene el token, no a un id del body", async () => {
    const { supervisor, employee, admin, project } = await makeOrg();

    const delegated = await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(supervisor.token))
      .send({ targetUserId: employee.user.id, projectId: project.id, supervisorId: admin.user.id })
      .expect(201);
    expect(delegated.body.editedById).toBe(supervisor.user.id);

    const edited = await request(app)
      .patch(`/time-entries/${delegated.body.id}`)
      .set(bearer(supervisor.token))
      .send({ clockOut: new Date(Date.now() + 60_000).toISOString(), editorId: admin.user.id })
      .expect(200);
    expect(edited.body.editedById).toBe(supervisor.user.id);
  });
});
