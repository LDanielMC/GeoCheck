import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setUnauthorizedHandler } from "../services/api";
import { fetchMe } from "../services/authService";
import { isUnauthorized } from "../services/errors";
import { clearSession, getCachedUser, getToken, saveSession, setCachedUser } from "../services/tokenStorage";
import type { Session, SessionUser } from "../types";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  // offline: no pudimos validar la sesión con el servidor y mostramos el último usuario guardado
  | { status: "signedIn"; user: SessionUser; offline: boolean };

interface AuthContextValue {
  state: AuthState;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  /** Vuelve a validar la sesión con el servidor (p. ej. tras recuperar la conexión). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const mounted = useRef(true);

  const signOut = useCallback(async () => {
    try {
      await clearSession();
    } catch {
      // Si el almacenamiento seguro falla igual salimos de la sesión en memoria.
    }
    if (mounted.current) setState({ status: "signedOut" });
  }, []);

  const signIn = useCallback(async (session: Session) => {
    await saveSession(session.token, session.user);
    setState({ status: "signedIn", user: session.user, offline: false });
  }, []);

  // Token inválido o vencido (401) → login. Sin conexión → seguimos con el último usuario guardado.
  const refresh = useCallback(async () => {
    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      token = null;
    }
    if (!token) {
      if (mounted.current) setState({ status: "signedOut" });
      return;
    }

    try {
      const user = await fetchMe();
      await setCachedUser(user);
      if (mounted.current) setState({ status: "signedIn", user, offline: false });
    } catch (error) {
      if (isUnauthorized(error)) {
        await signOut();
        return;
      }
      const cached = await getCachedUser();
      if (mounted.current) {
        setState(cached ? { status: "signedIn", user: cached, offline: true } : { status: "signedOut" });
      }
    }
  }, [signOut]);

  useEffect(() => {
    mounted.current = true;
    setUnauthorizedHandler(() => {
      void signOut();
    });
    void refresh();
    return () => {
      mounted.current = false;
      setUnauthorizedHandler(undefined);
    };
  }, [refresh, signOut]);

  const value = useMemo(() => ({ state, signIn, signOut, refresh }), [state, signIn, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
