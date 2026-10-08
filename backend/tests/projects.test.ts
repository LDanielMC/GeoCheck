import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { app, bearer, clockInAt, createProject, makeOrg, SITE, uniq } from "./helpers";

const NIL_UUID = "00000000-0000-4000-8000-000000000000";

describe("crear proyecto", () => {
  const post = (token: string, body: object) => request(app).post("/projects").set(bearer(token)).send(body);

  it("radio mínimo de 100 m (el spike mostró falsos positivos con radios menores), máximo de 1000 m, entero", async () => {
    const { admin } = await makeOrg();

    for (const radius of [20, 99, 99.9, 1001, 5000, -150]) {
      await post(admin.token, { name: "X", ...SITE, geofenceRadius: radius }).expect(400);
    }
    await post(admin.token, { name: "X", ...SITE, geofenceRadius: 100.5 }).expect(400);
    await post(admin.token, { name: "X", ...SITE, geofenceRadius: "150" }).expect(400);

    const min = await post(admin.token, { name: "Mínimo", ...SITE, geofenceRadius: 100 }).expect(201);
    const max = await post(admin.token, { name: "Máximo", ...SITE, geofenceRadius: 1000 }).expect(201);
    expect([min.body.geofenceRadius, max.body.geofenceRadius]).toEqual([100, 1000]);
  });

  it("el radio por defecto es 150 m", async () => {
    const { admin } = await makeOrg();
    const res = await post(admin.token, { name: "Por defecto", ...SITE }).expect(201);
    expect(res.body.geofenceRadius).toBe(150);
  });

  it("el mensaje de error dice cuál es el mínimo", async () => {
    const { admin } = await makeOrg();
    const res = await post(admin.token, { name: "X", ...SITE, geofenceRadius: 50 }).expect(400);
    expect(JSON.stringify(res.body)).toContain("100");
  });

  it("recorta el nombre, exige uno y limita su largo", async () => {
    const { admin } = await makeOrg();
    const ok = await post(admin.token, { name: "  Casa Reforma  ", ...SITE }).expect(201);
    expect(ok.body.name).toBe("Casa Reforma");
    await post(admin.token, { name: "   ", ...SITE }).expect(400);
    await post(admin.token, { ...SITE }).expect(400);
    await post(admin.token, { name: "x".repeat(121), ...SITE }).expect(400);
  });

  it("exige coordenadas numéricas válidas", async () => {
    const { admin } = await makeOrg();
    await post(admin.token, { name: "X" }).expect(400);
    await post(admin.token, { name: "X", latitude: "19.4", longitude: -99 }).expect(400);
    await post(admin.token, { name: "X", latitude: 90.0001, longitude: 0 }).expect(400);
    await post(admin.token, { name: "X", latitude: 0, longitude: 180.0001 }).expect(400);
    await post(admin.token, { name: "Polo", latitude: -90, longitude: 180 }).expect(201);
  });
});

describe("listar y ver proyectos", () => {
  it("lista ordenado por nombre y sin archivados", async () => {
    const { admin, supervisor } = await makeOrg();
    await createProject(admin.token, { name: "Zeta" });
    await createProject(admin.token, { name: "Alfa" });
    const archived = await createProject(admin.token, { name: "Beta (vieja)" });
    await request(app).patch(`/projects/${archived.id}`).set(bearer(admin.token)).send({ archived: true }).expect(200);

    const res = await request(app).get("/projects").set(bearer(supervisor.token)).expect(200);
    const names: string[] = res.body.map((p: { name: string }) => p.name);
    expect(names).toEqual(expect.arrayContaining(["Alfa", "Zeta"]));
    expect(names.indexOf("Alfa")).toBeLessThan(names.indexOf("Zeta"));
    expect(names).not.toContain("Beta (vieja)");
  });

  it("includeArchived lo usa el ADMIN (archivados al final); los demás roles reciben 403", async () => {
    const { admin, supervisor, employee, bookkeeper } = await makeOrg();
    const old = await createProject(admin.token, { name: "AAA archivada" });
    await request(app).patch(`/projects/${old.id}`).set(bearer(admin.token)).send({ archived: true }).expect(200);

    const res = await request(app).get("/projects?includeArchived=true").set(bearer(admin.token)).expect(200);
    const flags = res.body.map((p: { archived: boolean }) => p.archived);
    expect(flags).toContain(true);
    expect(flags).toEqual([...flags].sort((a: boolean, b: boolean) => Number(a) - Number(b))); // activos primero
    for (const member of [supervisor, employee, bookkeeper]) {
      await request(app).get("/projects?includeArchived=true").set(bearer(member.token)).expect(403);
    }
  });

  it("cualquier rol de la organización ve el detalle de un proyecto activo", async () => {
    const { admin, supervisor, employee, bookkeeper, project } = await makeOrg();
    for (const member of [admin, supervisor, employee, bookkeeper]) {
      const res = await request(app).get(`/projects/${project.id}`).set(bearer(member.token)).expect(200);
      expect(res.body).toMatchObject({ id: project.id, archived: false });
    }
    await request(app).get(`/projects/${project.id}`).expect(401);
  });

  it("un proyecto archivado solo lo ve el ADMIN; para el resto es 404", async () => {
    const { admin, supervisor, employee, project } = await makeOrg();
    await request(app).patch(`/projects/${project.id}`).set(bearer(admin.token)).send({ archived: true }).expect(200);

    await request(app).get(`/projects/${project.id}`).set(bearer(admin.token)).expect(200);
    for (const member of [supervisor, employee]) {
      await request(app).get(`/projects/${project.id}`).set(bearer(member.token)).expect(404);
    }
  });

  it("un id mal formado da 400 y uno inexistente 404", async () => {
    const { admin } = await makeOrg();
    await request(app).get("/projects/no-es-un-uuid").set(bearer(admin.token)).expect(400);
    await request(app).get(`/projects/${NIL_UUID}`).set(bearer(admin.token)).expect(404);
  });
});

describe("editar proyecto", () => {
  const patch = (token: string, id: string, body: object) => request(app).patch(`/projects/${id}`).set(bearer(token)).send(body);

  it("solo el ADMIN edita; SUPERVISOR, EMPLOYEE y BOOKKEEPER reciben 403 y sin token 401", async () => {
    const { admin, supervisor, employee, bookkeeper, project } = await makeOrg();
    for (const member of [supervisor, employee, bookkeeper]) {
      await patch(member.token, project.id, { name: "Hackeado" }).expect(403);
    }
    await request(app).patch(`/projects/${project.id}`).send({ name: "Sin token" }).expect(401);
    await patch(admin.token, project.id, { name: "Editado por el admin" }).expect(200);

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(stored.name).toBe("Editado por el admin");
  });

  it("actualiza solo los campos enviados", async () => {
    const { admin, project } = await makeOrg();
    const before = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });

    const res = await patch(admin.token, project.id, { geofenceRadius: 250 }).expect(200);
    expect(res.body).toMatchObject({ geofenceRadius: 250, name: before.name, latitude: before.latitude, longitude: before.longitude, archived: false });

    const moved = await patch(admin.token, project.id, { latitude: 19.5, longitude: -99.2, name: "  Nueva obra " }).expect(200);
    expect(moved.body).toMatchObject({ latitude: 19.5, longitude: -99.2, name: "Nueva obra", geofenceRadius: 250 });
  });

  it("aplica las mismas reglas que al crear (radio 100–1000, coordenadas, nombre)", async () => {
    const { admin, project } = await makeOrg();
    await patch(admin.token, project.id, { geofenceRadius: 99 }).expect(400);
    await patch(admin.token, project.id, { geofenceRadius: 1001 }).expect(400);
    await patch(admin.token, project.id, { geofenceRadius: 120.5 }).expect(400);
    await patch(admin.token, project.id, { name: "  " }).expect(400);
    await patch(admin.token, project.id, { latitude: 91, longitude: 0 }).expect(400);
    await patch(admin.token, project.id, { archived: "si" }).expect(400);
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(stored.geofenceRadius).toBe(120); // nada de lo anterior cambió el proyecto
  });

  it("latitud y longitud se actualizan juntas", async () => {
    const { admin, project } = await makeOrg();
    await patch(admin.token, project.id, { latitude: 19.5 }).expect(400);
    await patch(admin.token, project.id, { longitude: -99.2 }).expect(400);
  });

  it("un cuerpo vacío o con campos desconocidos es 400 (no hay nada que actualizar)", async () => {
    const { admin, project } = await makeOrg();
    await patch(admin.token, project.id, {}).expect(400);
    await patch(admin.token, project.id, { color: "rojo" }).expect(400);
  });

  it("no se puede mover un proyecto a otra organización con un organizationId en el body", async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    await patch(a.admin.token, a.project.id, { name: "Sigue siendo mío", organizationId: b.admin.user.organizationId }).expect(200);
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: a.project.id } });
    expect(stored.organizationId).toBe(a.admin.user.organizationId);
  });

  it("un proyecto de otra organización es 404 y no se modifica", async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    await patch(b.admin.token, a.project.id, { name: "Intruso", geofenceRadius: 900, archived: true }).expect(404);
    await request(app).get(`/projects/${a.project.id}`).set(bearer(b.admin.token)).expect(404);

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: a.project.id } });
    expect(stored).toMatchObject({ geofenceRadius: 120, archived: false });
    expect(stored.name).not.toBe("Intruso");
  });

  it("id mal formado 400, inexistente 404", async () => {
    const { admin } = await makeOrg();
    await patch(admin.token, "123", { name: "X" }).expect(400);
    await patch(admin.token, NIL_UUID, { name: "X" }).expect(404);
  });
});

describe("archivar y restaurar", () => {
  const setArchived = (token: string, id: string, archived: boolean) =>
    request(app).patch(`/projects/${id}`).set(bearer(token)).send({ archived });

  it("archivar es idempotente y reversible", async () => {
    const { admin, project } = await makeOrg();
    expect((await setArchived(admin.token, project.id, true).expect(200)).body.archived).toBe(true);
    expect((await setArchived(admin.token, project.id, true).expect(200)).body.archived).toBe(true);
    expect((await setArchived(admin.token, project.id, false).expect(200)).body.archived).toBe(false);

    const list = await request(app).get("/projects").set(bearer(admin.token)).expect(200);
    expect(list.body.map((p: { id: string }) => p.id)).toContain(project.id);
  });

  it("un proyecto archivado no admite fichajes nuevos; al restaurarlo vuelve a admitirlos", async () => {
    const { admin, employee, project } = await makeOrg();
    await setArchived(admin.token, project.id, true).expect(200);
    await clockInAt(employee.token, project.id).then((res) => expect(res.status).toBe(404));

    await setArchived(admin.token, project.id, false).expect(200);
    await clockInAt(employee.token, project.id).then((res) => expect(res.status).toBe(201));
  });

  it("archivar no borra las horas ya registradas", async () => {
    const { admin, employee, project } = await makeOrg();
    await clockInAt(employee.token, project.id).then((res) => expect(res.status).toBe(201));
    await setArchived(admin.token, project.id, true).expect(200);
    expect(await prisma.timeEntry.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("los nombres pueden repetirse entre proyectos (no hay restricción de unicidad)", async () => {
    const { admin } = await makeOrg();
    const name = `Repetida ${uniq()}`;
    await createProject(admin.token, { name });
    await createProject(admin.token, { name });
  });
});
