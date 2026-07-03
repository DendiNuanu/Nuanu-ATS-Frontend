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
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? "Invalid email or password." };
        }

        const authedUser: AuthUser = {
          name: data.user.name,
          role: data.user.role,
          email: data.user.email,
        };

        try {
          localStorage.setItem(STORAGE_KEY, "true");
          localStorage.setItem(USER_KEY, JSON.stringify(authedUser));
        } catch {
          // ignore storage errors
        }
        setUser(authedUser);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error. Please try again." };
      }
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
