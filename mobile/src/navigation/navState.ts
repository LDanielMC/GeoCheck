import type { Project, UserRole } from "../types";
import { firstTab, tabsForRole, type TabId } from "./tabs";

// Pantallas que se abren encima de una pestaña (con la barra inferior oculta). `project = null` es una obra nueva.
export type PushedScreen = { name: "project"; project: Project | null } | { name: "profile" } | { name: "company" };

export interface NavState {
  tab: TabId;
  stack: PushedScreen[];
}

// Navegación por estado, sin librería: una pestaña activa y una pila de pantallas encima. Todo son funciones puras para
// poder probarlas en Node; el botón «atrás» de Android lo atiende un solo manejador (Shell), no cada pantalla.

export const initialNav = (role: UserRole): NavState => ({ tab: firstTab(role), stack: [] });

// Si el servidor cambia el rol de la persona, la pestaña actual puede ya no existir para ese rol.
export function validNav(state: NavState, role: UserRole): NavState {
  return tabsForRole(role).includes(state.tab) ? state : initialNav(role);
}

// Cambia de pestaña (una que el rol no tiene se ignora). Tocar la pestaña activa también vuelve a su raíz.
export function selectTab(state: NavState, tab: TabId, role: UserRole): NavState {
  return tabsForRole(role).includes(tab) ? { tab, stack: [] } : state;
}

export const push = (state: NavState, screen: PushedScreen): NavState => ({ ...state, stack: [...state.stack, screen] });

export const pop = (state: NavState): NavState => (state.stack.length > 0 ? { ...state, stack: state.stack.slice(0, -1) } : state);

// «Atrás»: cierra la pantalla de encima; desde la raíz de otra pestaña vuelve a la primera; desde la primera deja que Android
// cierre la app (`handled: false`).
export function back(state: NavState, role: UserRole): { state: NavState; handled: boolean } {
  if (state.stack.length > 0) return { state: pop(state), handled: true };
  if (state.tab !== firstTab(role)) return { state: initialNav(role), handled: true };
  return { state, handled: false };
}

// La barra de pestañas se oculta en pantallas a pantalla completa (el editor de obra).
export const showsTabBar = (state: NavState): boolean => state.stack.length === 0;
