"use client";

import { useAuth, type AuthUser } from "@/lib/auth-context";
import { currentUser } from "@/lib/mock-data";

export type CurrentUser = AuthUser;

/**
 * Shared hook that returns the logged-in user's display info.
 *
 * Both the Sidebar and TopBar consume this hook so they always show the
 * same name/role. Falls back to the mock `currentUser` when no session
 * is active (e.g. during SSR or direct navigation before auth resolves).
 */
export function useCurrentUser(): {
  user: CurrentUser;
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const { user, isAuthenticated, isLoading } = useAuth();

  return {
    user: user ?? currentUser,
    isAuthenticated,
    isLoading,
  };
}
