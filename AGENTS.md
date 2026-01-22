# Agents

## App Structure

### Stack

- Generally: Typescript
- Frontend: React, Tailwind CSS, shadcn/ui (Base UI), TanStack Router, TanStack Query, Lucide React, Zustand
- Backend: Bun, Elysia
- Database: Convex

### Routing

We use TanStack Router for routing. Refer to the rules in the .cursor folder for more details.

## Rules

### General

- Try to DRY the code as much as possible by creating or reusing utils and smaller components
- Follow the single responsibility principle and provide functions with their own file grouped logically in folders.
- Always provide detailed JSDOC for types, functions, components, etc.
- Be generous with comments and documentation.
- We do not use SSR in this project.
- Always run `bun run typecheck` after refactoring to ensure type safety and code quality.

### Typescript

- Never cast to 'any'
- Do not add extra defensive check or try/catch blocks unless absolutely necessary
- When defining interfaces, put JSDoc comments above the interface definition using @property tags, instead of above each individual property

### React

- Follow React best practices.
- Separate big components into smaller ones to avoid rerendering of the whole component when only a part of it changes
- Avoid rendering multiple components in a single file
- Always create custom hooks when using Tanstack Query, Zustand, useEffect, etc. and give them a descriptive name
- Avoid inline styles and use tailwind classes instead
- No need to bother with SSR hydration error as we don't use SSR in this project. Optimize for SPA using tanstack router.
- Avoid memoization as we are using the React Compiler to automatically optimize the code (no need for useMemo or useCallback).

### Tanstack Router & Data Fetching

Components should be split into:

- main: Main component that renders the UI
- stateful: Fetching component using react query/zustand custom hooks that fetches the data and passes it to the UI component
- ui: Component receiving props from the stateful component

Fetch at the lowest level possible and use the stateful component to fetch the data and pass it to the UI component.
This allows to avoid rerendering the whole component when only a part of it changes.

#### URL State Management

Use TanStack Router's URL search params for state that should be shareable, bookmarkable, or persist across navigation (tabs, filters, pagination, selected items). Use `validateSearch` to parse/validate params and `useNavigate` + `Route.useSearch()` to read/update. Keep ephemeral UI state (popover open, search terms) as local state.

### Tanstack Query

Always create a queryOptions object and pass it to the useQuery or useSuspenseQuery hook. This will allow to reuse the queryOptions object in the loader of the route.

### Zustand

Always study and follow the [Zustand Skill](./.cursor/skills/zustand/SKILL.md) if working with Zustand.

### Elysia

- Use Convex by default and Elysia for the backend.
- When creating routes, always use the zod validator to validate the request body and query parameters and export its type.
- On the client use the existing Eden client that is already created and use it to make the requests.
- You can always use Tanstack Query on the client but wrapping the Eden methods instead of fetch.

**Important:** Always use method chaining when defining routes to ensure proper Eden type generation:

```typescript
// ✅ Correct - generates Eden types
export const myRoute = new Elysia()
  .get('/path', async ({ query }) => { ... })

// ❌ Wrong - breaks Eden type inference
export const myRoute = new Elysia()
myRoute.get('/path', async ({ query }) => { ... })
```

### Convex

For Convex-specific patterns and best practices, see [documentation/convex/](./documentation/convex/):

- [Convex Nested Functions Access Patterns](./documentation/convex/convex-nested-functions.md) - Correct patterns for accessing nested Convex functions (queries, mutations, actions) with proper TypeScript type resolution
