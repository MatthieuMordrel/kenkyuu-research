import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExampleState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

// Example store with persistence
export const useExampleStore = create<ExampleState>()(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      reset: () => set({ count: 0 }),
    }),
    {
      name: "example-store", // localStorage key
    }
  )
);
