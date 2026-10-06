import { describe, expect, it } from "vitest";
import { minutesAgo, parseClock } from "./time";

// Fechas locales: el reloj que escribe la persona es el local del teléfono.
const now = new Date(2026, 9, 5, 17, 40, 0);
const hms = (d: Date | null) => (d ? `${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}` : null);

describe("hora de un cruce capturado después", () => {
  it("interpreta HH:MM y HH:MM:SS como hoy", () => {
    expect(hms(parseClock("17:36", now))).toBe("5 17:36:0");
    expect(hms(parseClock("17:36:20", now))).toBe("5 17:36:20");
    expect(hms(parseClock(" 9:05 ", now))).toBe("5 9:5:0");
  });

  it("una hora que aún no ha llegado hoy se entiende de ayer (prueba nocturna capturada por la mañana)", () => {
    const morning = new Date(2026, 9, 6, 7, 30, 0);
    expect(hms(parseClock("22:50", morning))).toBe("5 22:50:0");
  });

  it("tolera un minuto: escribir la hora actual no salta a ayer", () => {
    const justBefore = new Date(2026, 9, 5, 17, 35, 50);
    expect(hms(parseClock("17:36", justBefore))).toBe("5 17:36:0");
    expect(hms(parseClock("17:38", justBefore))).toBe("4 17:38:0");
  });

  it("rechaza texto que no es una hora", () => {
    for (const bad of ["", "abc", "25:00", "12:60", "12:30:61", "1730", "17:3"]) expect(parseClock(bad, now)).toBeNull();
  });

  it("minutesAgo resta minutos exactos", () => {
    expect(minutesAgo(5, now).getTime()).toBe(now.getTime() - 300_000);
    expect(minutesAgo(0, now).getTime()).toBe(now.getTime());
  });
});
