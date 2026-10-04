import express from "express";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { errorHandler, HttpError } from "../src/errors";
import { app } from "./helpers";

afterEach(() => vi.restoreAllMocks());

// Mini-app con rutas que fallan de distintas formas, montada sobre el errorHandler real.
function appThatThrows(error: unknown) {
  const mini = express();
  mini.get("/boom", () => {
    throw error;
  });
  mini.use(errorHandler);
  return mini;
}

describe("manejo de errores", () => {
  it("un error inesperado devuelve 500 genérico, sin filtrar el mensaje interno", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appThatThrows(new Error('relation "User" does not exist at db.internal:5432'))).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
    expect(res.text).not.toMatch(/relation|db\.internal/);
    expect(spy).toHaveBeenCalled(); // pero sí queda en el log del servidor
  });

  it("un error de Prisma no filtra sus detalles: P2002 → 409 con mensaje propio", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["email"] },
    });
    const res = await request(appThatThrows(error)).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Ya existe un registro con esos datos" });
    expect(res.text).not.toMatch(/email|constraint/i);
  });

  it("un HttpError conserva su código y su mensaje", async () => {
    const res = await request(appThatThrows(new HttpError(418, "Soy una tetera"))).get("/boom");
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: "Soy una tetera" });
  });

  it("un JSON mal formado responde 400, no 500", async () => {
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{ no es json");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/json/i);
  });

  it("un cuerpo demasiado grande responde 413", async () => {
    const res = await request(app).post("/auth/login").send({ email: "a@b.com", password: "x".repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it("una ruta inexistente responde 404 en JSON", async () => {
    const res = await request(app).get("/no-existe");
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(expect.any(String));
  });
});

describe("GET /health", () => {
  it("responde ok y comprueba la base de datos", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });

  it("responde 503 si la base de datos no contesta", async () => {
    const down = createApp({ checkDatabase: () => Promise.reject(new Error("connection refused")) });
    const res = await request(down).get("/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", db: "down" });
  });
});
