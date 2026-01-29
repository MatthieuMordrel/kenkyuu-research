# Agents

## App Structure

### Stack

- Generally: Typescript
- Frontend: React, Tailwind CSS, shadcn/ui (Base UI), TanStack Router, TanStack Query, Zustand, Lucide React
- Database: Convex
- Backend: Convex

Except if explicitly stated otherwise, favor using Convex without Tanstack Query for as many things as possible and store the data there. You may use Tanstack Query for async state management when not storing the data in Convex.

## Documentation

CRITICAL: ALWAYS REFER TO THE DOCUMENTATION OF THE LIBRARY IF WORKING WITH IT.

**Skill Documentation**: Detailed guides for specific technologies are located in `.agents/skills/`:

- [Convex](./.agents/skills/convex/SKILL.md) - Database and backend functions patterns
- [Zustand](./.agents/skills/zustand/SKILL.md) - Client state management patterns
- [TanStack Query](./.agents/skills/tanstack-query/SKILL.md) - Server state management patterns

**Project Documentation**: Additional project-specific documentation is in `documentation/`:

- [Development](./documentation/development/) - Development setup and workflows
- [Linting](./documentation/linting/) - Linting rules and patterns
- [Agents](./documentation/agents/) - Agent-specific documentation

## Rules

### General

- Try to DRY the code as much as possible by creating or reusing utils and smaller components
- Follow the single responsibility principle and provide functions with their own file grouped logically in folders.
- Always provide detailed JSDOC for types, functions, components, etc.
- Be generous with comments and documentation.
- Always run `bun run typecheck` and `bun run lint` after refactoring to ensure type safety and code quality.

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

### TanStack Router & Data Fetching

#### Component Structure

- **main** – Renders the overall UI and layout.
- **stateful** – Uses React Query/Zustand via custom hooks to fetch data and passes results to the UI layer.
- **ui** – Receives props from the stateful component and renders presentational elements.

**Best Practices:**

- **Fetch at the lowest level:** Place data fetching in the stateful component, then pass data down to the UI component. This minimizes unnecessary rerenders when only a subset of the UI updates.
- **Component isolation:** Avoid having multiple major components per file for maintainability and to optimize rendering.

#### URL State Management with TanStack Router

- Manage shareable or persistent state (such as tabs, filters, pagination, selected items) with TanStack Router’s URL search params.
- Use `validateSearch` for parsing and validation.
- Access and update with `useNavigate` and `Route.useSearch()`.
- Keep ephemeral/local UI state (e.g., open popovers, input search terms) in local component state.

### Linting

Always run `bun run lint` after refactoring to ensure code quality.
When linting for a specific linting rule, refer to the documentation in `documentation/linting/` for more information.
