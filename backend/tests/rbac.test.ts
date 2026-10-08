import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { app, bearer, clockInAt, makeOrg, SITE } from "./helpers";

// Matriz de permisos por rol sobre los endpoints de proyectos y fichajes.

describe("proyectos", () => {
  const newProject = { name: "Nueva obra", ...SITE, geofenceRadius: 150 };

  it("solo el ADMIN crea proyectos; SUPERVISOR, EMPLOYEE y BOOKKEEPER reciben 403", async () => {
    const { admin, supervisor, employee, bookkeeper } = await makeOrg();

    await request(app).post("/projects").set(bearer(admin.token)).send(newProject).expect(201);
    for (const member of [supervisor, employee, bookkeeper]) {
      await request(app).post("/projects").set(bearer(member.token)).send(newProject).expect(403);
    }
    await request(app).post("/projects").send(newProject).expect(401);
  });

  it("todos los roles de la organización pueden listar sus proyectos", async () => {
    const { admin, supervisor, employee, bookkeeper, project } = await makeOrg();

    for (const member of [admin, supervisor, employee, bookkeeper]) {
      const res = await request(app).get("/projects").set(bearer(member.token)).expect(200);
      expect(res.body.map((p: { id: string }) => p.id)).toEqual([project.id]);
    }
    await request(app).get("/projects").expect(401);
  });

  it("valida nombre, coordenadas y radio (100–1000 m; el detalle está en projects.test.ts)", async () => {
    const { admin } = await makeOrg();
    const post = (body: object) => request(app).post("/projects").set(bearer(admin.token)).send(body);

    await post({ name: "", ...SITE }).expect(400);
    await post({ name: "X", latitude: 91, longitude: 0 }).expect(400);
    await post({ name: "X", latitude: 0, longitude: -181 }).expect(400);
    await post({ name: "X", ...SITE, geofenceRadius: 99 }).expect(400);
    await post({ name: "X", ...SITE, geofenceRadius: 1001 }).expect(400);
    await post({ name: "X", ...SITE, geofenceRadius: 100.5 }).expect(400);
    const ok = await post({ name: "X", ...SITE }).expect(201);
    expect(ok.body.geofenceRadius).toBe(150); // valor por defecto
  });

  it("no lista los proyectos archivados", async () => {
    const { admin, project } = await makeOrg();
    await prisma.project.update({ where: { id: project.id }, data: { archived: true } });

    const res = await request(app).get("/projects").set(bearer(admin.token)).expect(200);
    expect(res.body).toEqual([]);
  });
});

describe("fichajes", () => {
  it("ADMIN, SUPERVISOR y EMPLOYEE pueden fichar; BOOKKEEPER (solo lectura) recibe 403", async () => {
    const { admin, supervisor, employee, bookkeeper, project } = await makeOrg();

    for (const member of [admin, supervisor, employee]) {
      await clockInAt(member.token, project.id).then((res) => expect(res.status).toBe(201));
    }
    await clockInAt(bookkeeper.token, project.id).then((res) => expect(res.status).toBe(403));
    await request(app).post("/time-entries/clock-in").send({ projectId: project.id }).expect(401);
  });

  it("solo ADMIN y SUPERVISOR fichan por otras personas", async () => {
    const { admin, supervisor, employee, bookkeeper, project } = await makeOrg();
    const body = { targetUserId: employee.user.id, projectId: project.id };

    await request(app).post("/time-entries/delegated-clock-in").set(bearer(employee.token)).send(body).expect(403);
    await request(app).post("/time-entries/delegated-clock-in").set(bearer(bookkeeper.token)).send(body).expect(403);
    await request(app).post("/time-entries/delegated-clock-in").set(bearer(supervisor.token)).send(body).expect(201);
    // El ADMIN también puede (con otro destinatario, porque employee ya quedó con una entrada abierta).
    await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(admin.token))
      .send({ targetUserId: supervisor.user.id, projectId: project.id })
      .expect(201);
  });

  it("solo ADMIN y SUPERVISOR editan entradas", async () => {
    const { supervisor, employee, bookkeeper, project } = await makeOrg();
    const entry = (await clockInAt(employee.token, project.id)).body;
    const edit = { clockOut: new Date(Date.now() + 3_600_000).toISOString() };

    await request(app).patch(`/time-entries/${entry.id}`).set(bearer(employee.token)).send(edit).expect(403);
    await request(app).patch(`/time-entries/${entry.id}`).set(bearer(bookkeeper.token)).send(edit).expect(403);
    await request(app).patch(`/time-entries/${entry.id}`).set(bearer(supervisor.token)).send(edit).expect(200);
  });
});
