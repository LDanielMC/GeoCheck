import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { errorHandler } from "../src/errors";
import { createPlacesRouter } from "../src/routes/places";
import { createPlacesService, type FetchLike } from "../src/services/placesService";
import { bearer, makeOrg, registerOrg } from "./helpers";

const SESSION = "0b8f0c1e-6d0a-4f0e-9a3b-111111111111";
const PLACE_ID = "ChIJj61dQgK6j4AR4GeTYWZsKWw";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

// Un «Google» de mentira: guarda las llamadas y responde lo que se le diga. Los tests nunca tocan la red.
function fakeGoogle(reply: (call: Call) => { ok?: boolean; status?: number; body?: unknown } | Error) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call: Call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const result = reply(call);
    if (result instanceof Error) throw result;
    return { ok: result.ok ?? true, status: result.status ?? 200, json: async () => result.body };
  };
  return { calls, fetchImpl };
}

const goodGoogle = () =>
  fakeGoogle((call) =>
    call.url.endsWith("places:autocomplete")
      ? { body: { suggestions: [{ placePrediction: { placeId: PLACE_ID, text: { text: "1600 Pennsylvania Avenue NW, Washington, DC, USA" } } }, { queryPrediction: { text: { text: "ignorada" } } }] } }
      : { body: { id: PLACE_ID, formattedAddress: "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA", location: { latitude: 38.8977, longitude: -77.0365 } } }
  );

const appWith = (google: ReturnType<typeof fakeGoogle>, placesRateLimit?: { perMinute?: number; perDay?: number }) =>
  createApp({ placesService: createPlacesService("clave-de-prueba", google.fetchImpl), placesRateLimit });

const autocomplete = (app: ReturnType<typeof createApp>, token: string, query: Record<string, string> = { q: "1600 Penn", session: SESSION }) =>
  request(app).get("/places/autocomplete").query(query).set(bearer(token));

describe("autocompletado de direcciones (Google Places, API New)", () => {
  it("devuelve sugerencias y pide a Google solo EE. UU., con la clave en el encabezado y la sesión", async () => {
    const google = goodGoogle();
    const app = appWith(google);
    const { admin } = await makeOrg();

    const res = await autocomplete(app, admin.token).expect(200);

    expect(res.body).toEqual({ suggestions: [{ placeId: PLACE_ID, description: "1600 Pennsylvania Avenue NW, Washington, DC, USA" }] });
    expect(google.calls).toHaveLength(1);
    const [call] = google.calls;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(call.url).not.toContain("clave-de-prueba"); // la clave nunca viaja en la URL
    expect(call.headers["X-Goog-Api-Key"]).toBe("clave-de-prueba");
    expect(call.body).toMatchObject({ input: "1600 Penn", sessionToken: SESSION, includedRegionCodes: ["us"] });
  });

  it("los detalles piden SOLO ubicación y dirección (Essentials) con el mismo token de sesión que cierra el cobro", async () => {
    const google = goodGoogle();
    const app = appWith(google);
    const { admin } = await makeOrg();

    const res = await request(app).get("/places/details").query({ placeId: PLACE_ID, session: SESSION }).set(bearer(admin.token)).expect(200);

    expect(res.body).toEqual({ placeId: PLACE_ID, label: "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA", latitude: 38.8977, longitude: -77.0365 });
    const [call] = google.calls;
    expect(call.method).toBe("GET");
    expect(call.url).toBe(`https://places.googleapis.com/v1/places/${PLACE_ID}?sessionToken=${SESSION}`);
    expect(call.headers["X-Goog-Api-Key"]).toBe("clave-de-prueba");
    // Un campo Pro (displayName, businessStatus...) subiría el cobro de $5 a $17 por 1 000: este test lo impide.
    expect(call.headers["X-Goog-FieldMask"]).toBe("id,location,formattedAddress");
  });

  it("exige sesión iniciada y rol ADMIN", async () => {
    const google = goodGoogle();
    const app = appWith(google);
    const { supervisor, employee, bookkeeper } = await makeOrg();

    await request(app).get("/places/autocomplete").query({ q: "1600 Penn", session: SESSION }).expect(401);
    for (const member of [supervisor, employee, bookkeeper]) await autocomplete(app, member.token).expect(403);
    expect(google.calls).toHaveLength(0);
  });

  it("valida la consulta antes de gastar una petición de Google: mínimo 3 caracteres, máximo 200, sesión y lugar bien formados", async () => {
    const google = goodGoogle();
    const app = appWith(google);
    const { admin } = await makeOrg();

    await autocomplete(app, admin.token, { q: "ab", session: SESSION }).expect(400);
    await autocomplete(app, admin.token, { q: "  a ", session: SESSION }).expect(400);
    await autocomplete(app, admin.token, { q: "x".repeat(201), session: SESSION }).expect(400);
    await autocomplete(app, admin.token, { q: "1600 Penn" }).expect(400);
    await autocomplete(app, admin.token, { q: "1600 Penn", session: "corta" }).expect(400);
    await autocomplete(app, admin.token, { q: "1600 Penn", session: "no es válida ../" }).expect(400);
    await request(app).get("/places/details").query({ placeId: "../x", session: SESSION }).set(bearer(admin.token)).expect(400);
    await request(app).get("/places/details").query({ session: SESSION }).set(bearer(admin.token)).expect(400);
    expect(google.calls).toHaveLength(0);

    await autocomplete(app, admin.token, { q: "abc", session: SESSION }).expect(200);
  });

  it("limita las peticiones por usuario, no por IP: un usuario agotado no afecta a otro", async () => {
    const google = goodGoogle();
    const app = appWith(google, { perMinute: 2 });
    const a = await registerOrg({}, app);
    const b = await registerOrg({}, app);

    await autocomplete(app, a.token).expect(200);
    await autocomplete(app, a.token).expect(200);
    const blocked = await autocomplete(app, a.token).expect(429);
    expect(blocked.body.error).toMatch(/demasiadas búsquedas/i);
    expect(google.calls).toHaveLength(2); // la tercera no llegó a Google

    await autocomplete(app, b.token).expect(200);
  });

  it("también hay un tope diario por usuario", async () => {
    const google = goodGoogle();
    const app = appWith(google, { perMinute: 100, perDay: 3 });
    const { admin } = await makeOrg();

    for (let i = 0; i < 3; i++) await autocomplete(app, admin.token).expect(200);
    const blocked = await autocomplete(app, admin.token).expect(429);
    expect(blocked.body.error).toMatch(/límite diario/i);
  });

  it("si Google falla responde 502 con un mensaje genérico, sin filtrar la clave ni el detalle", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { admin } = await makeOrg();

    for (const reply of [
      () => ({ ok: false, status: 403, body: { error: { message: "API key not valid: clave-de-prueba" } } }),
      () => new Error("fetch failed clave-de-prueba"),
      () => ({ body: { algo: "inesperado" } }),
    ]) {
      const app = appWith(fakeGoogle(reply));
      const details = await request(app).get("/places/details").query({ placeId: PLACE_ID, session: SESSION }).set(bearer(admin.token)).expect(502);
      expect(JSON.stringify(details.body)).not.toContain("clave-de-prueba");
    }
    const failing = await autocomplete(appWith(fakeGoogle(() => ({ ok: false, status: 500 }))), admin.token).expect(502);
    expect(failing.body.error).toMatch(/servicio de direcciones/i);
    quiet.mockRestore();
  });

  it("una respuesta sin sugerencias válidas es una lista vacía, no un error", async () => {
    const app = appWith(fakeGoogle(() => ({ body: {} })));
    const { admin } = await makeOrg();
    const res = await autocomplete(app, admin.token).expect(200);
    expect(res.body).toEqual({ suggestions: [] });
  });

  it("sin clave configurada responde 503 (la app pasa al buscador del teléfono)", async () => {
    const bare = express().use("/places", createPlacesRouter({ service: undefined, perMinute: 60, perDay: 300 })).use(errorHandler);
    const { admin } = await makeOrg();
    const res = await autocomplete(bare as never, admin.token).expect(503);
    expect(res.body.error).toMatch(/no está configurado/i);
  });
});
