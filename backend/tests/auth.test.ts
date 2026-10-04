import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { getConfig } from "../src/config";
import { prisma } from "../src/db";
import { app, bearer, PASSWORD, registerOrg, uniq } from "./helpers";

describe("POST /auth/register-organization", () => {
  it("crea la organización y su ADMIN, y guarda el correo en minúsculas", async () => {
    const id = uniq();
    const res = await request(app)
      .post("/auth/register-organization")
      .send({ organizationName: ` Constructora ${id} `, name: "Ana", email: `  ANA-${id}@Test.COM `, password: PASSWORD })
      .expect(201);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      name: "Ana",
      email: `ana-${id}@test.com`,
      role: "ADMIN",
      organization: { name: `Constructora ${id}` },
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: `ana-${id}@test.com` } });
    expect(stored.role).toBe("ADMIN");
    expect(stored.organizationId).toBe(res.body.user.organizationId);
    expect(stored.passwordHash).not.toBe(PASSWORD); // guardada con hash
  });

  it("rechaza un correo repetido (sin distinguir mayúsculas) con 409 y no deja una organización huérfana", async () => {
    const first = await registerOrg();
    const orphanName = `Huérfana ${uniq()}`;

    const res = await request(app)
      .post("/auth/register-organization")
      .send({ organizationName: orphanName, name: "Otra", email: first.email.toUpperCase(), password: PASSWORD })
      .expect(409);

    expect(res.body.error).toMatch(/ya existe una cuenta/i);
    expect(await prisma.organization.count({ where: { name: orphanName } })).toBe(0);
  });

  it("valida los datos y responde 400 con detalle por campo", async () => {
    const res = await request(app)
      .post("/auth/register-organization")
      .send({ organizationName: "", name: "Ana", email: "no-es-correo", password: "corta" })
      .expect(400);

    expect(res.body.error).toEqual(expect.any(String));
    const paths = res.body.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["organizationName", "email", "password"]));
  });

  it("exige contraseñas de 8 caracteres o más", async () => {
    const res = await request(app)
      .post("/auth/register-organization")
      .send({ organizationName: "X", name: "Ana", email: `a-${uniq()}@test.com`, password: "1234567" })
      .expect(400);
    expect(res.body.error).toMatch(/8 caracteres/);
  });
});

describe("POST /auth/login", () => {
  it("inicia sesión y no distingue mayúsculas en el correo", async () => {
    const account = await registerOrg();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: account.email.toUpperCase(), password: PASSWORD })
      .expect(200);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ id: account.user.id, role: "ADMIN" });
  });

  it("da exactamente el mismo error para correo inexistente y contraseña incorrecta", async () => {
    const account = await registerOrg();
    const wrongPassword = await request(app).post("/auth/login").send({ email: account.email, password: "incorrecta1" }).expect(401);
    const unknownEmail = await request(app).post("/auth/login").send({ email: `nadie-${uniq()}@test.com`, password: PASSWORD }).expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error).toBe("Credenciales inválidas");
  });
});

describe("authenticate y GET /auth/me", () => {
  it("devuelve al usuario autenticado con su organización", async () => {
    const account = await registerOrg();
    const res = await request(app).get("/auth/me").set(bearer(account.token)).expect(200);
    expect(res.body.user).toMatchObject({
      id: account.user.id,
      email: account.email,
      role: "ADMIN",
      organization: { id: account.user.organizationId },
    });
  });

  it("responde 401 sin token, con token mal formado o con otro esquema", async () => {
    await request(app).get("/auth/me").expect(401);
    await request(app).get("/auth/me").set(bearer("esto-no-es-un-jwt")).expect(401);
    await request(app).get("/auth/me").set({ Authorization: "Basic abc" }).expect(401);
  });

  it("responde 401 con un token expirado", async () => {
    const account = await registerOrg();
    const expired = jwt.sign({}, getConfig().JWT_SECRET, { subject: account.user.id, expiresIn: -10 });
    const res = await request(app).get("/auth/me").set(bearer(expired)).expect(401);
    expect(res.body.error).toMatch(/inválida o expirada/i);
  });

  it("responde 401 con un token firmado con otro secreto o sin firma", async () => {
    const account = await registerOrg();
    const forged = jwt.sign({}, "otro-secreto-otro-secreto-otro-secreto-00", { subject: account.user.id });
    const unsigned = jwt.sign({}, "", { subject: account.user.id, algorithm: "none" });
    await request(app).get("/auth/me").set(bearer(forged)).expect(401);
    await request(app).get("/auth/me").set(bearer(unsigned)).expect(401);
  });

  it("responde 401 si el usuario ya no existe, aunque el token sea válido", async () => {
    const account = await registerOrg();
    await prisma.user.delete({ where: { id: account.user.id } });
    await request(app).get("/auth/me").set(bearer(account.token)).expect(401);
  });

  it("usa el rol actual de la BD, no el que tenía al iniciar sesión", async () => {
    const account = await registerOrg();
    await request(app)
      .post("/projects")
      .set(bearer(account.token))
      .send({ name: "Antes", latitude: 1, longitude: 1 })
      .expect(201);

    await prisma.user.update({ where: { id: account.user.id }, data: { role: "EMPLOYEE" } });

    const me = await request(app).get("/auth/me").set(bearer(account.token)).expect(200);
    expect(me.body.user.role).toBe("EMPLOYEE");
    await request(app)
      .post("/projects")
      .set(bearer(account.token))
      .send({ name: "Después", latitude: 1, longitude: 1 })
      .expect(403);
  });
});
