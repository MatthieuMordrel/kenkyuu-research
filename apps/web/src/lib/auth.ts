import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist, createJSONStorage } from "zustand/middleware";

const TOKEN_STORAGE_KEY = "kenkyustock-auth";

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
}

interface AuthActions {
  loggedIn: (token: string, expiresAt: number) => void;
  loggedOut: () => void;
  setHasHydrated: (state: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      isAuthenticated: false,
      _hasHydrated: false,

      loggedIn: (token: string, expiresAt: number) =>
        set({ token, expiresAt, isAuthenticated: true }),

      loggedOut: () =>
        set({ token: null, expiresAt: null, isAuthenticated: false }),

      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: TOKEN_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Check if token has expired on rehydrate
          if (state.expiresAt && state.expiresAt < Date.now()) {
            state.loggedOut();
          }
          state.setHasHydrated(true);
        }
      },
    },
  ),
);

// Atomic selectors
export const useAuthToken = () => useAuthStore((s) => s.token);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useAuthHasHydrated = () => useAuthStore((s) => s._hasHydrated);

// Actions hook
export const useAuthActions = () =>
  useAuthStore(
    useShallow((s) => ({
      loggedIn: s.loggedIn,
      loggedOut: s.loggedOut,
    })),
  );

// Direct store access for non-React contexts (e.g., router beforeLoad)
export const getAuthState = () => useAuthStore.getState();
