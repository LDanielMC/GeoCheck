import { describe, expect, it } from "vitest";
import type { Project, UserRole } from "../types";
import { back, initialNav, pop, push, selectTab, showsTabBar, validNav } from "./navState";
import { firstTab, tabsForRole } from "./tabs";

const ROLES: UserRole[] = ["ADMIN", "SUPERVISOR", "EMPLOYEE", "BOOKKEEPER"];
const PROJECT = { id: "p1", name: "Casa Reforma" } as Project;

describe("pestañas por rol", () => {
  it("administrador y supervisor ven las cinco; el empleado no tiene Equipo; el contador no ficha ni tiene Inicio", () => {
    expect(tabsForRole("ADMIN")).toEqual(["home", "projects", "records", "team", "more"]);
    expect(tabsForRole("SUPERVISOR")).toEqual(["home", "projects", "records", "team", "more"]);
    expect(tabsForRole("EMPLOYEE")).toEqual(["home", "projects", "records", "more"]);
    expect(tabsForRole("BOOKKEEPER")).toEqual(["projects", "records", "more"]);
  });

  it("todos los roles tienen «Más» al final, y la app abre en su primera pestaña", () => {
    for (const role of ROLES) {
      const tabs = tabsForRole(role);
      expect(tabs.at(-1)).toBe("more");
      expect(firstTab(role)).toBe(tabs[0]);
    }
    expect(firstTab("BOOKKEEPER")).toBe("projects");
    expect(firstTab("EMPLOYEE")).toBe("home");
  });

  it("nadie ve Equipo salvo administrador y supervisor", () => {
    expect(ROLES.filter((role) => tabsForRole(role).includes("team"))).toEqual(["ADMIN", "SUPERVISOR"]);
  });
});

describe("estado de navegación", () => {
  it("empieza en la primera pestaña del rol, sin pantallas encima", () => {
    expect(initialNav("EMPLOYEE")).toEqual({ tab: "home", stack: [] });
    expect(initialNav("BOOKKEEPER")).toEqual({ tab: "projects", stack: [] });
  });

  it("cambia de pestaña, ignora las que el rol no tiene y descarta lo que había encima", () => {
    let state = selectTab(initialNav("ADMIN"), "projects", "ADMIN");
    state = push(state, { name: "project", project: PROJECT });
    expect(selectTab(state, "more", "ADMIN")).toEqual({ tab: "more", stack: [] });
    expect(selectTab(initialNav("EMPLOYEE"), "team", "EMPLOYEE")).toEqual({ tab: "home", stack: [] });
  });

  it("tocar la pestaña activa vuelve a su raíz", () => {
    const state = push(selectTab(initialNav("ADMIN"), "projects", "ADMIN"), { name: "project", project: null });
    expect(selectTab(state, "projects", "ADMIN")).toEqual({ tab: "projects", stack: [] });
  });

  it("apila y desapila pantallas; la barra de pestañas se oculta mientras haya una encima", () => {
    const root = selectTab(initialNav("ADMIN"), "projects", "ADMIN");
    expect(showsTabBar(root)).toBe(true);
    const form = push(root, { name: "project", project: null });
    expect(showsTabBar(form)).toBe(false);
    expect(form.stack).toEqual([{ name: "project", project: null }]);
    expect(pop(form)).toEqual(root);
    expect(pop(root)).toBe(root);
  });

  it("si el rol cambia y la pestaña ya no existe, vuelve al inicio del nuevo rol", () => {
    const team = selectTab(initialNav("ADMIN"), "team", "ADMIN");
    expect(validNav(team, "EMPLOYEE")).toEqual({ tab: "home", stack: [] });
    expect(validNav(team, "ADMIN")).toBe(team);
    expect(validNav(selectTab(initialNav("ADMIN"), "home", "ADMIN"), "BOOKKEEPER")).toEqual({ tab: "projects", stack: [] });
  });
});

describe("botón «atrás» de Android", () => {
  it("cierra la pantalla de encima primero", () => {
    const state = push(selectTab(initialNav("ADMIN"), "projects", "ADMIN"), { name: "project", project: PROJECT });
    const result = back(state, "ADMIN");
    expect(result.handled).toBe(true);
    expect(result.state).toEqual({ tab: "projects", stack: [] });
  });

  it("desde la raíz de otra pestaña vuelve a la primera, no cierra la app", () => {
    const result = back(selectTab(initialNav("ADMIN"), "more", "ADMIN"), "ADMIN");
    expect(result).toEqual({ state: { tab: "home", stack: [] }, handled: true });
  });

  it("desde la primera pestaña deja que Android cierre la app", () => {
    const state = initialNav("EMPLOYEE");
    expect(back(state, "EMPLOYEE")).toEqual({ state, handled: false });
  });

  it("para el contador la primera pestaña es Obras", () => {
    expect(back(selectTab(initialNav("BOOKKEEPER"), "more", "BOOKKEEPER"), "BOOKKEEPER").state.tab).toBe("projects");
    expect(back(initialNav("BOOKKEEPER"), "BOOKKEEPER").handled).toBe(false);
  });

  it("el recorrido completo: perfil abierto desde Más → atrás → Más → atrás → Inicio → atrás sale", () => {
    let state = push(selectTab(initialNav("EMPLOYEE"), "more", "EMPLOYEE"), { name: "profile" });
    state = back(state, "EMPLOYEE").state;
    expect(state).toEqual({ tab: "more", stack: [] });
    state = back(state, "EMPLOYEE").state;
    expect(state.tab).toBe("home");
    expect(back(state, "EMPLOYEE").handled).toBe(false);
  });
});
