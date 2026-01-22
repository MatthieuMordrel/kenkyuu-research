# Convex Nested Functions Access Patterns

## Overview

When organizing Convex functions (queries, mutations, actions) into subdirectories, there are specific access patterns you must follow to ensure TypeScript types resolve correctly. This document explains the correct patterns and common pitfalls.

## File Structure

Convex automatically maps your file structure to the API. For example:

```
convex/
├── queries/
│   ├── jobs/
│   │   ├── list.ts          → exports `list`
│   │   ├── getByBullhornId.ts → exports `getByBullhornId`
│   │   └── countOpen.ts     → exports `countOpen`
│   └── openAiDeepResearch/
│       ├── listRecent.ts    → exports `listRecent`
│       └── getById.ts       → exports `getById`
├── mutations/
│   └── openAiDeepResearch/
│       ├── create.ts        → exports `create`
│       └── updateOnWebhook.ts → exports `updateOnWebhook`
└── actions/
    └── openAiDeepResearch/
        ├── create.ts        → exports `create`
        └── processWebhook.ts → exports `processWebhook`
```

## Access Patterns

### Public API (Client-side)

For **public** queries, mutations, and actions accessed from the client:

```typescript
// ✅ CORRECT: Double-name pattern
api.queries.jobs.list.list
api.queries.jobs.getByBullhornId.getByBullhornId
api.queries.openAiDeepResearch.listRecent.listRecent

api.mutations.someModule.someMutation.someMutation
api.actions.someModule.someAction.someAction
```

**Pattern**: `api.[type].[directory].[filename].[exportName]`

### Internal API (Server-side)

For **internal** queries, mutations, and actions accessed from other Convex functions:

#### Mutations and Actions

```typescript
// ✅ CORRECT: Double-name pattern with dot notation
internal.mutations.openAiDeepResearch.create.create
internal.mutations.openAiDeepResearch.updateOnWebhook.updateOnWebhook
internal.actions.openAiDeepResearch.processWebhook.processWebhook
```

**Pattern**: `internal.[type].[directory].[filename].[exportName]`

#### Queries

```typescript
// ✅ CORRECT: Double-name pattern with BRACKET notation for directory
internal.queries['openAiDeepResearch'].getById.getById
internal.queries['openAiDeepResearch'].getByResponseId.getByResponseId
```

**Pattern**: `internal.queries['directory'].[filename].[exportName]`

**Important**: Queries require bracket notation for the directory name due to TypeScript index signature requirements. Mutations and actions can use dot notation.

## Why the Double-Name Pattern?

Convex generates types based on your file structure. When you have:

- File: `queries/jobs/list.ts`
- Export: `export const list = query({...})`

Convex creates a nested structure:

- `queries/jobs/list` → becomes `queries.jobs.list` in the API
- The export name `list` becomes another level: `queries.jobs.list.list`

This is why you need to repeat the export name twice.

## Common Mistakes

### ❌ Wrong: Single name

```typescript
// This will cause TypeScript errors
api.queries.jobs.list
internal.mutations.openAiDeepResearch.create
```

### ❌ Wrong: Missing bracket notation for internal queries

```typescript
// This will cause TypeScript error TS4111
internal.queries.openAiDeepResearch.getById.getById
```

### ✅ Correct: Full pattern

```typescript
// Public queries
api.queries.jobs.list.list

// Internal queries (note bracket notation)
internal.queries['openAiDeepResearch'].getById.getById

// Internal mutations/actions
internal.mutations.openAiDeepResearch.create.create
internal.actions.openAiDeepResearch.processWebhook.processWebhook
```

## Examples

### Example 1: Public Query (Client-side)

```typescript
// File: convex/queries/jobs/list.ts
export const list = query({...})

// Usage in frontend:
import { api } from '@steve-skills/convex'
import { convexQuery } from '@convex-dev/react-query'

const queryOptions = () => queryOptions({
  ...convexQuery(api.queries.jobs.list.list, {})
})
```

### Example 2: Internal Query (Server-side)

```typescript
// File: convex/queries/openAiDeepResearch/getById.ts
export const getById = internalQuery({...})

// Usage in action:
import { internal } from '../_generated/api'

const record = await ctx.runQuery(
  internal.queries['openAiDeepResearch'].getById.getById,
  { id: recordId }
)
```

### Example 3: Internal Mutation (Server-side)

```typescript
// File: convex/mutations/openAiDeepResearch/create.ts
export const create = internalMutation({...})

// Usage in action:
import { internal } from '../_generated/api'

const recordId = await ctx.runMutation(
  internal.mutations.openAiDeepResearch.create.create,
  { blog_title: '...', ... }
)
```

### Example 4: Internal Action (Server-side)

```typescript
// File: convex/actions/openAiDeepResearch/processWebhook.ts
export const processWebhook = action({...})

// Usage in another action:
import { internal } from '../_generated/api'

await ctx.scheduler.runAfter(0,
  internal.actions.openAiDeepResearch.processWebhook.processWebhook,
  { ... }
)
```

## Quick Reference

| Type     | Public API                    | Internal API                        |
| -------- | ----------------------------- | ----------------------------------- |
| Query    | `api.queries.dir.file.file`   | `internal.queries['dir'].file.file` |
| Mutation | `api.mutations.dir.file.file` | `internal.mutations.dir.file.file`  |
| Action   | `api.actions.dir.file.file`   | `internal.actions.dir.file.file`    |

**Key Points:**

- Always use double-name pattern: `[filename].[exportName]`
- Internal queries require bracket notation: `internal.queries['directory']`
- Internal mutations/actions use dot notation: `internal.mutations.directory`
- Public API always uses dot notation: `api.queries.directory`

## Troubleshooting

### TypeScript Error: "Property 'X' comes from an index signature"

**Problem**: You're using dot notation for internal queries.

**Solution**: Use bracket notation:

```typescript
// ❌ Wrong
internal.queries.openAiDeepResearch.getById.getById

// ✅ Correct
internal.queries['openAiDeepResearch'].getById.getById
```

### TypeScript Error: "Argument of type '{ X: FunctionReference... }' is not assignable"

**Problem**: You're missing the double-name pattern.

**Solution**: Add the export name twice:

```typescript
// ❌ Wrong
internal.mutations.openAiDeepResearch.create

// ✅ Correct
internal.mutations.openAiDeepResearch.create.create
```

## Best Practices

1. **Consistent Naming**: Keep filename and export name the same for clarity

   - File: `create.ts` → Export: `export const create = ...`

2. **Directory Organization**: Group related functions in subdirectories

   - `queries/jobs/` for all job-related queries
   - `mutations/openAiDeepResearch/` for all deep research mutations

3. **Type Safety**: Always use the generated `internal` and `api` from `_generated/api`

   - Never manually construct function references
   - Let TypeScript guide you with autocomplete

4. **Documentation**: When creating new nested functions, document the access pattern in comments

## Related Files

- Convex API generation: `convex/_generated/api.d.ts`
- Convex documentation: [Convex Functions](https://docs.convex.dev/functions)
