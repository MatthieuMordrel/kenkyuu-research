import { useAction, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { useCallback } from "react";
import {
  useAuthToken,
  useIsAuthenticated,
  useAuthHasHydrated,
  useAuthActions,
} from "@/lib/auth";

export function useAuth() {
  const token = useAuthToken();
  const isAuthenticated = useIsAuthenticated();
  const hasHydrated = useAuthHasHydrated();
  const { loggedIn, loggedOut } = useAuthActions();

  const loginAction = useAction(api.auth.login);
  const logoutAction = useAction(api.auth.logout);

  // Validate session reactively via Convex query
  const sessionValidation = useQuery(
    api.authHelpers.validateSession,
    token ? { token } : "skip",
  );

  // If we think we're authenticated but the server says invalid, log out
  const isSessionValid = sessionValidation?.valid ?? false;
  const isLoading = !hasHydrated || (isAuthenticated && sessionValidation === undefined);
  const effectivelyAuthenticated = isAuthenticated && isSessionValid;

  const login = useCallback(
    async (password: string, rememberMe: boolean) => {
      const result = await loginAction({ password, rememberMe });
      loggedIn(result.token, result.expiresAt);
    },
    [loginAction, loggedIn],
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutAction({ token });
      } catch {
        // Ignore logout errors — clear local state regardless
      }
    }
    loggedOut();
  }, [token, logoutAction, loggedOut]);

  return {
    isAuthenticated: effectivelyAuthenticated,
    isLoading,
    token,
    login,
    logout,
  };
}
