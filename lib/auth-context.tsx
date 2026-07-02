"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type AuthUser = {
  name: string;
  role: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const STORAGE_KEY = "nuanu_auth";
const USER_KEY = "nuanu_user";

// Hardcoded mock super-admin credentials (frontend-only prototype).
const MOCK_EMAIL = "job@nuanu.com";
const MOCK_PASSWORD = "jobnuanu0361";
const MOCK_USER: AuthUser = {
  name: "Super Admin",
  role: "Super Admin",
  email: MOCK_EMAIL,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, read auth state from localStorage.
  useEffect(() => {
    try {
      const authed = localStorage.getItem(STORAGE_KEY);
      const stored = localStorage.getItem(USER_KEY);
      if (authed === "true" && stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // localStorage not available (SSR) — ignore.
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      // Simulate a network auth check delay.
      await new Promise((r) => setTimeout(r, 700));

      if (email.trim().toLowerCase() === MOCK_EMAIL && password === MOCK_PASSWORD) {
        try {
          localStorage.setItem(STORAGE_KEY, "true");
          localStorage.setItem(USER_KEY, JSON.stringify(MOCK_USER));
        } catch {
          // ignore storage errors
        }
        setUser(MOCK_USER);
        return { ok: true };
      }
      return { ok: false, error: "Invalid email or password." };
    },
    [],
  );

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
