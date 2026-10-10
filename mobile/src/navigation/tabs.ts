import type { UserRole } from "../types";

// Pestañas de la barra inferior (rebanada D1). Cada rol ve solo lo que usa:
// - El empleado no tiene «Equipo».
// - El contador no ficha, así que no tiene «Inicio»: su trabajo real es el panel web (US-20 no es del MVP).
export type TabId = "home" | "projects" | "records" | "team" | "more";

const TABS_BY_ROLE: Record<UserRole, readonly TabId[]> = {
  ADMIN: ["home", "projects", "records", "team", "more"],
  SUPERVISOR: ["home", "projects", "records", "team", "more"],
  EMPLOYEE: ["home", "projects", "records", "more"],
  BOOKKEEPER: ["projects", "records", "more"],
};

export const tabsForRole = (role: UserRole): readonly TabId[] => TABS_BY_ROLE[role];

// La pestaña donde se abre la app y a la que «atrás» vuelve antes de salir.
export const firstTab = (role: UserRole): TabId => TABS_BY_ROLE[role][0];
