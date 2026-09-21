import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FarmerOut } from "../types";
import {
  AuthAPI,
  clearAccessToken,
  setAccessToken,
  setUnauthorizedHandler,
} from "./api";

export interface AuthState {
  status: "loading" | "anon" | "authed";
  farmer: FarmerOut | null;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (name: string, phone: string, password: string) => Promise<void>;
  signOut: () => void;
  updateName: (name: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always start in "loading": on a fresh page load the access token lives
  // only in memory (it is gone), but the httpOnly refresh cookie may still be
  // valid — so we must probe /auth/me, which silently rotates the cookie for a
  // new access token, before deciding authed vs anon.
  const [status, setStatus] = useState<"loading" | "anon" | "authed">("loading");
  const [farmer, setFarmer] = useState<FarmerOut | null>(null);

  const setAnon = useCallback(() => {
    clearAccessToken();
    setFarmer(null);
    setStatus("anon");
  }, []);

  useEffect(() => {
    // Global session-expiry hook used by the axios interceptor (any 401 that
    // the refresh path cannot recover from bounces the whole app to anon).
    setUnauthorizedHandler(() => setAnon());

    let cancelled = false;
    void (async () => {
      try {
        // If a refresh cookie exists, /auth/me 401s first, the interceptor
        // calls /auth/refresh with the cookie, then retries with a fresh
        // access token. If no cookie exists, refresh fails -> setAnon.
        const { data } = await AuthAPI.me();
        if (cancelled) return;
        setFarmer(data);
        setStatus("authed");
      } catch {
        if (!cancelled) setAnon();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAnon]);

  const signIn = useCallback(async (phone: string, password: string) => {
    const { data } = await AuthAPI.login(phone, password);
    // Only the access token crosses JS; the refresh token lands in the
    // httpOnly cookie via the Set-Cookie response header.
    setAccessToken(data.access_token);
    const { data: me } = await AuthAPI.me();
    setFarmer(me);
    setStatus("authed");
  }, []);

  const signUp = useCallback(
    async (name: string, phone: string, password: string) => {
      // /auth/signup returns only the profile (no tokens), so sign in after.
      await AuthAPI.signup({ name, phone_number: phone, password });
      await signIn(phone, password);
    },
    [signIn],
  );

  const signOut = useCallback(() => {
    // Fire-and-forget: revoke the refresh token + clear the httpOnly cookie
    // server-side, then drop the in-memory token regardless of network fate —
    // an offline logout must not leave the user "logged in".
    AuthAPI.logout().catch(() => {});
    setAnon();
  }, [setAnon]);

  const updateName = useCallback(async (name: string) => {
    const updated = await AuthAPI.updateName(name);
    setFarmer(updated);
  }, []);

  const deleteAccount = useCallback(async () => {
    await AuthAPI.deleteMe();
    setAnon();
  }, [setAnon]);

  const value = useMemo<AuthState>(
    () => ({ status, farmer, signIn, signUp, signOut, updateName, deleteAccount }),
    [status, farmer, signIn, signUp, signOut, updateName, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}