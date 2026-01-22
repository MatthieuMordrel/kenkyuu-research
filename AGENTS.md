# Agents

## App Structure

### Stack

- Generally: Typescript
- Frontend: React, Tailwind CSS, shadcn/ui (Base UI), TanStack Router, TanStack Query, Lucide React, Zustand
- Backend: Bun, Elysia
- Database: Convex

### Routing

We use TanStack Router for routing. Refer to the rules in the .cursor folder for more details.

## Documentation

**Skill Documentation**: Detailed guides for specific technologies are located in `.agents/skills/`:

- [TanStack Query](./.agents/skills/tanstack-query/SKILL.md) - Server state management patterns
- [Zustand](./.agents/skills/zustand/SKILL.md) - Client state management patterns
- [Elysia](./.agents/skills/elysia/SKILL.md) - Backend API development patterns
- [Convex](./.agents/skills/convex/SKILL.md) - Database and backend functions patterns

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

Always study and follow the [TanStack Query Skill](./.agents/skills/tanstack-query/SKILL.md) if working with TanStack Query.

### Zustand

Always study and follow the [Zustand Skill](./.agents/skills/zustand/SKILL.md) if working with Zustand.

### Elysia

Always study and follow the [Elysia Skill](./.agents/skills/elysia/SKILL.md) if working with Elysia.

### Convex

Always study and follow the [Convex Skill](./.agents/skills/convex/SKILL.md) if working with Convex.
