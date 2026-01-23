import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Separate state from actions
interface StoreState {
  count: number;
  _hasHydrated: boolean;
}

interface StoreActions {
  incremented: () => void;
  decremented: () => void;
  countReset: () => void;
  setHasHydrated: (state: boolean) => void;
}

type Store = StoreState & StoreActions;

// Do not export the base store - use custom hooks instead
const useStore = create<Store>()(
  persist(
    (set) => ({
      // State
      count: 0,
      _hasHydrated: false,

      // Actions (modeled as events, not setters)
      incremented: () => set((state) => ({ count: state.count + 1 })),
      decremented: () => set((state) => ({ count: state.count - 1 })),
      countReset: () => set({ count: 0 }),
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: "example-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist state, not actions
      partialize: (state) => ({
        count: state.count,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Export atomic selectors via custom hooks (1 hook per state value)
export const useCount = () => useStore((state) => state.count);
export const useHasHydrated = () => useStore((state) => state._hasHydrated);

// Export 1 hook for all actions
export const useExampleStoreActions = () =>
  useStore((state) => ({
    incremented: state.incremented,
    decremented: state.decremented,
    countReset: state.countReset,
  }));
