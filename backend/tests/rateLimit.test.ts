import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { bearer, PASSWORD, registerOrg, uniq } from "./helpers";

// Cada createApp() tiene su propio contador, así que estos tests no se afectan entre sí ni al resto.

describe("rate limit en /auth", () => {
  it("bloquea con 429 después de N intentos fallidos de login", async () => {
    const limited = createApp({ authRateLimitMax: 3 });
    const attempt = () => request(limited).post("/auth/login").send({ email: `nadie-${uniq()}@test.com`, password: PASSWORD });

    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/demasiados intentos/i);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("también frena a quien prueba códigos de invitación al azar", async () => {
    const limited = createApp({ authRateLimitMax: 3 });
    const guess = () =>
      request(limited).post("/auth/join").send({ code: "ABCDEFGH", name: "X", email: `x-${uniq()}@test.com`, password: PASSWORD });

    for (let i = 0; i < 3; i++) expect((await guess()).status).toBe(400);
    expect((await guess()).status).toBe(429);
  });

  it("cuenta solo los fallos: una cuadrilla entera puede unirse o iniciar sesión desde la misma IP", async () => {
    const limited = createApp({ authRateLimitMax: 3 });
    const account = await registerOrg({}, limited); // registro exitoso: no cuenta

    for (let i = 0; i < 6; i++) {
      await request(limited).post("/auth/login").send({ email: account.email, password: PASSWORD }).expect(200);
    }
  });

  it("no limita /auth/me ni el resto de la API", async () => {
    const limited = createApp({ authRateLimitMax: 1 });
    const account = await registerOrg({}, limited);

    // Se agota el cupo de /auth con un fallo...
    await request(limited).post("/auth/login").send({ email: account.email, password: "incorrecta1" }).expect(401);
    await request(limited).post("/auth/login").send({ email: account.email, password: "incorrecta1" }).expect(429);

    // ...y aun así el resto sigue funcionando.
    for (let i = 0; i < 5; i++) {
      await request(limited).get("/auth/me").set(bearer(account.token)).expect(200);
    }
    await request(limited).get("/projects").set(bearer(account.token)).expect(200);
  });
});
