import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FarmerOut } from "../types";
import {
  AuthAPI,
  clearTokens,
  isAuthed,
  setTokens,
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
  const [status, setStatus] = useState<"loading" | "anon" | "authed">(
    isAuthed() ? "loading" : "anon",
  );
  const [farmer, setFarmer] = useState<FarmerOut | null>(null);

  const setAnon = useCallback(() => {
    clearTokens();
    setFarmer(null);
    setStatus("anon");
  }, []);

  useEffect(() => {
    // Global session-expiry hook used by the axios interceptor.
    setUnauthorizedHandler(() => setAnon());

    void (async () => {
      if (!isAuthed()) return;
      try {
        // Interceptor refreshes the token if the access token expired.
        const { data } = await AuthAPI.me();
        setFarmer(data);
        setStatus("authed");
      } catch {
        setAnon();
      }
    })();
  }, [setAnon]);

  const signIn = useCallback(async (phone: string, password: string) => {
    const { data } = await AuthAPI.login(phone, password);
    setTokens(data);
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

  const signOut = useCallback(() => setAnon(), [setAnon]);

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