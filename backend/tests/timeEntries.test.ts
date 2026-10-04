import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { app, bearer, clockInAt, makeOrg, SITE } from "./helpers";

describe("POST /time-entries/clock-in", () => {
  it("ficha automáticamente cuando las coordenadas están dentro del geofence", async () => {
    const { employee, project } = await makeOrg();
    const res = await clockInAt(employee.token, project.id);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: employee.user.id, projectId: project.id, type: "AUTO", clockOut: null });
  });

  it("rechaza con 422 un fichaje automático fuera del radio (≈1 km de distancia)", async () => {
    const { employee, project } = await makeOrg();
    const res = await clockInAt(employee.token, project.id, { lat: SITE.latitude + 0.01 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/fuera del radio/i);
    expect(await prisma.timeEntry.count({ where: { userId: employee.user.id } })).toBe(0);
  });

  it("exige lat y lon en el fichaje automático, pero no en el manual (RF-05)", async () => {
    const { employee, project } = await makeOrg();

    await request(app).post("/time-entries/clock-in").set(bearer(employee.token)).send({ projectId: project.id }).expect(400);
    const manual = await request(app)
      .post("/time-entries/clock-in")
      .set(bearer(employee.token))
      .send({ projectId: project.id, type: "MANUAL" })
      .expect(201);
    expect(manual.body.type).toBe("MANUAL");
  });

  it("no ficha en un proyecto archivado ni inexistente (404)", async () => {
    const { employee, project } = await makeOrg();
    await prisma.project.update({ where: { id: project.id }, data: { archived: true } });

    expect((await clockInAt(employee.token, project.id)).status).toBe(404);
    expect((await clockInAt(employee.token, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await clockInAt(employee.token, "no-es-uuid")).status).toBe(400);
  });

  it("rechaza con 409 un segundo fichaje mientras hay uno abierto", async () => {
    const { employee, project } = await makeOrg();
    expect((await clockInAt(employee.token, project.id)).status).toBe(201);

    const second = await clockInAt(employee.token, project.id);
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/entrada activa/i);
  });

  it("con peticiones simultáneas solo una entrada queda abierta (índice único parcial)", async () => {
    const { employee, project } = await makeOrg();

    const responses = await Promise.all(Array.from({ length: 4 }, () => clockInAt(employee.token, project.id)));
    const statuses = responses.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409, 409, 409]);
    expect(await prisma.timeEntry.count({ where: { userId: employee.user.id, clockOut: null } })).toBe(1);
  });

  it("permite fichar de nuevo después de cerrar la entrada", async () => {
    const { employee, project } = await makeOrg();
    const first = (await clockInAt(employee.token, project.id)).body;
    await request(app).post(`/time-entries/${first.id}/clock-out`).set(bearer(employee.token)).expect(200);

    expect((await clockInAt(employee.token, project.id)).status).toBe(201);
  });
});

describe("POST /time-entries/:id/clock-out", () => {
  it("cierra la propia entrada", async () => {
    const { employee, project } = await makeOrg();
    const entry = (await clockInAt(employee.token, project.id)).body;

    const res = await request(app).post(`/time-entries/${entry.id}/clock-out`).set(bearer(employee.token)).expect(200);
    expect(res.body.clockOut).toEqual(expect.any(String));
    expect(res.body.editedById).toBeNull(); // cerrarla uno mismo no cuenta como edición
  });

  it("responde 409 si la entrada ya estaba cerrada y no cambia la hora de salida", async () => {
    const { employee, project } = await makeOrg();
    const entry = (await clockInAt(employee.token, project.id)).body;
    const first = await request(app).post(`/time-entries/${entry.id}/clock-out`).set(bearer(employee.token)).expect(200);

    await request(app).post(`/time-entries/${entry.id}/clock-out`).set(bearer(employee.token)).expect(409);
    const stored = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(stored.clockOut?.toISOString()).toBe(first.body.clockOut);
  });

  it("un empleado no cierra la entrada de otro (403), pero un supervisor sí y queda registrado", async () => {
    const { employee, supervisor, bookkeeper, project } = await makeOrg();
    const entry = (await clockInAt(employee.token, project.id)).body;

    await request(app).post(`/time-entries/${entry.id}/clock-out`).set(bearer(supervisor.token)).expect(200);
    const stored = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(stored.clockOut).not.toBeNull();
    expect(stored.editedById).toBe(supervisor.user.id);

    // Otra entrada, ahora con un compañero de rol EMPLOYEE (el bookkeeper ni siquiera puede fichar)
    const other = (await clockInAt(supervisor.token, project.id)).body;
    await request(app).post(`/time-entries/${other.id}/clock-out`).set(bearer(employee.token)).expect(403);
    await request(app).post(`/time-entries/${other.id}/clock-out`).set(bearer(bookkeeper.token)).expect(403);
  });
});

describe("POST /time-entries/delegated-clock-in", () => {
  it("crea una entrada DELEGATED a nombre del destinatario y la atribuye al supervisor", async () => {
    const { supervisor, employee, project } = await makeOrg();
    const res = await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(supervisor.token))
      .send({ targetUserId: employee.user.id, projectId: project.id })
      .expect(201);

    expect(res.body).toMatchObject({
      userId: employee.user.id,
      type: "DELEGATED",
      editedById: supervisor.user.id,
      clockOut: null,
    });
  });

  it("responde 409 si el destinatario ya tiene una entrada abierta", async () => {
    const { supervisor, employee, project } = await makeOrg();
    await clockInAt(employee.token, project.id);

    await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(supervisor.token))
      .send({ targetUserId: employee.user.id, projectId: project.id })
      .expect(409);
  });

  it("responde 404 si el destinatario no existe", async () => {
    const { supervisor, project } = await makeOrg();
    await request(app)
      .post("/time-entries/delegated-clock-in")
      .set(bearer(supervisor.token))
      .send({ targetUserId: "00000000-0000-4000-8000-000000000000", projectId: project.id })
      .expect(404);
  });
});

describe("PATCH /time-entries/:id", () => {
  it("edita las horas y registra quién y cuándo", async () => {
    const { supervisor, employee, project } = await makeOrg();
    const entry = (await clockInAt(employee.token, project.id)).body;
    const clockIn = new Date(Date.now() - 8 * 3_600_000).toISOString();
    const clockOut = new Date(Date.now() - 3_600_000).toISOString();

    const res = await request(app)
      .patch(`/time-entries/${entry.id}`)
      .set(bearer(supervisor.token))
      .send({ clockIn, clockOut })
      .expect(200);

    expect(res.body).toMatchObject({ clockIn, clockOut, editedById: supervisor.user.id });
    expect(res.body.editedAt).toEqual(expect.any(String));
  });

  it("rechaza una salida anterior a la entrada y un cuerpo vacío (400)", async () => {
    const { supervisor, employee, project } = await makeOrg();
    const entry = (await clockInAt(employee.token, project.id)).body;
    const patch = (body: object) => request(app).patch(`/time-entries/${entry.id}`).set(bearer(supervisor.token)).send(body);

    await patch({ clockOut: new Date(Date.now() - 3_600_000).toISOString() }).expect(400); // antes de clockIn (que es "ahora")
    await patch({}).expect(400);
    await patch({ clockOut: "ayer" }).expect(400);
  });
});
