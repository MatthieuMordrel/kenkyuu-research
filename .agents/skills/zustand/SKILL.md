---
name: zustand
description: >
  Best practices for using Zustand state management in this project,
  following patterns from tkdodo's blog post "Working with Zustand".
  Use when creating stores, selectors, actions, or persisting state.
license: MIT
metadata:
  author: Matthieu Mordrel
  version: "1.0.0"
---

# Zustand Best Practices

Guidelines for state management using Zustand in this project.

## When to Use This Skill

Use this skill when:

- Creating or modifying a Zustand store
- Defining selectors or actions
- Persisting state to localStorage
- Deciding between lifting state up vs using Zustand

## Core Principles

### Use Zustand Instead of Lifting State Up

Don't hesitate to use Zustand for state management instead of lifting state up. It provides better performance and cleaner component architecture.

### Fine-Grained Subscriptions via Atomic Selectors

Always use atomic selectors (one value per hook) to get fine-grained subscriptions. This avoids unnecessary re-renders without needing `useShallow`.

```tsx
// ✅ Good - atomic selectors via custom hooks (preferred)
const count = useCount();
const total = useTotal();
const actions = useStoreActions();

// ❌ Avoid - bundling multiple values requires useShallow to prevent re-renders
const { count, total } = useMyStore((state) => ({
  count: state.count,
  total: state.total,
}));
```

## Best Practices (from tkdodo)

Follow best practices from [Working with Zustand](https://tkdodo.eu/blog/working-with-zustand):

### 1. Separate Actions from State

Keep actions separate from state to improve readability and maintainability.

```tsx
interface StoreState {
  count: number;
}

interface StoreActions {
  increment: () => void;
  reset: () => void;
}

type Store = StoreState & StoreActions;
```

### 2. Only Export Custom Hooks

- **Do not subscribe to the base store!** Do not `export` it if not needed.
- Export 1 custom hook per state
- Export 1 custom hook for all actions
- This avoids consumers having to write selectors

```tsx
// ✅ Good - export custom hooks
export const useCount = () => useStore(state => state.count);
export const useTotal = () => useStore(state => state.total);
export const useStoreActions = () => useStore(state => state.actions);

// ❌ Bad - exporting the base store
export const useStore = create<Store>(...);
```

### 3. Prefer Atomic Selectors (except for actions)

Use one selector per state. This prevents components from re-rendering when unrelated state changes.

```tsx
// ✅ Good - atomic selectors
const count = useCount();
const total = useTotal();

// ❌ Bad - selecting large state objects
const { count, total, items, filters } = useStore((state) => state);
```

### 4. Model Actions as Events, Not Setters

Keep business logic inside the store by creating descriptive action names that represent what happened, not what should change.

```tsx
// ✅ Good - event-based actions
const actions = {
  itemAdded: (item: Item) =>
    set((state) => ({
      items: [...state.items, item],
      total: state.total + item.price,
    })),
  orderCompleted: () => set({ items: [], total: 0 }),
};

// ❌ Bad - setter-based actions
const actions = {
  setItems: (items: Item[]) => set({ items }),
  setTotal: (total: number) => set({ total }),
};
```

### 5. Keep the Scope of Your Store Small

Create focused stores for specific domains rather than one large global store.

### 6. Combine with Other Libraries

Use custom hooks to combine Zustand with other libraries like React Query when needed.

## Persisting State

### Handle Loading State

If persisting state in localStorage, ensure to provide a loading state until the state is loaded from localStorage to avoid flickering.

```tsx
import { persist, createJSONStorage } from "zustand/middleware";

const useStore = create(
  persist<Store>(
    (set) => ({
      // ... state and actions
      _hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: "my-store",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Export a hook to check hydration status
export const useHasHydrated = () => useStore((state) => state._hasHydrated);
```

### Never Store Actions in Storage

Actions cannot be serialized and will cause hydration issues. Use `partialize` to only store state values.

```tsx
persist<Store>(
  (set) => ({
    /* ... */
  }),
  {
    name: "my-store",
    partialize: (state) => ({
      // Only include state, not actions
      count: state.count,
      items: state.items,
    }),
  }
);
```

### Split Stores into Slices

Zustand recommends having a single store and composing it from slices for larger applications.

```tsx
import { StateCreator } from "zustand";

interface CountSlice {
  count: number;
  increment: () => void;
}

const createCountSlice: StateCreator<Store, [], [], CountSlice> = (set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
});

// Compose slices in the main store
const useStore = create<Store>((...args) => ({
  ...createCountSlice(...args),
  ...createOtherSlice(...args),
}));
```

## Anti-Patterns to Avoid

1. **Exporting the base store** - Always export custom hooks instead
2. **Large selectors** - Use atomic selectors to prevent unnecessary re-renders
3. **Setter-style actions** - Use event-based actions that encapsulate business logic
4. **Storing actions in localStorage** - Use `partialize` to exclude functions
5. **Forgetting hydration state** - Always handle the loading state when persisting
