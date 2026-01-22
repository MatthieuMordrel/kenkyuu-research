---
name: convex
description: Use when working with Convex database and backend functions. Covers nested function access patterns for queries, mutations, and actions with proper TypeScript type resolution.
updated: 2026-01-20
keywords: convex, database, queries, mutations, actions, nested-functions, type-safety
---

# Convex - Complete Guide

**Convex** is the real-time backend-as-a-service used for database operations in this project. This guide covers essential patterns for accessing nested Convex functions with proper TypeScript type resolution.

## Nested Functions Access Patterns

**Critical**: When organizing Convex functions into subdirectories, you must follow specific access patterns to ensure TypeScript types resolve correctly.

### Public API (Client-side)

For **public** queries, mutations, and actions accessed from the client:

```typescript
// ✅ CORRECT: Double-name pattern
api.queries.jobs.list.list;
api.queries.jobs.getByBullhornId.getByBullhornId;
api.mutations.someModule.someMutation.someMutation;
api.actions.someModule.someAction.someAction;
```

**Pattern**: `api.[type].[directory].[filename].[exportName]`

### Internal API (Server-side)

For **internal** queries, mutations, and actions accessed from other Convex functions:

#### Mutations and Actions

```typescript
// ✅ CORRECT: Double-name pattern with dot notation
internal.mutations.openAiDeepResearch.create.create;
internal.actions.openAiDeepResearch.processWebhook.processWebhook;
```

**Pattern**: `internal.[type].[directory].[filename].[exportName]`

#### Queries

```typescript
// ✅ CORRECT: Double-name pattern with BRACKET notation for directory
internal.queries["openAiDeepResearch"].getById.getById;
```

**Pattern**: `internal.queries['directory'].[filename].[exportName]`

**Important**: Queries require bracket notation for the directory name due to TypeScript index signature requirements. Mutations and actions can use dot notation.

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

## Common Mistakes

**❌ Wrong: Single name**

```typescript
// This will cause TypeScript errors
api.queries.jobs.list;
internal.mutations.openAiDeepResearch.create;
```

**❌ Wrong: Missing bracket notation for internal queries**

```typescript
// This will cause TypeScript error TS4111
internal.queries.openAiDeepResearch.getById.getById;
```

**✅ Correct: Full pattern**

```typescript
// Public queries
api.queries.jobs.list.list;

// Internal queries (note bracket notation)
internal.queries["openAiDeepResearch"].getById.getById;

// Internal mutations/actions
internal.mutations.openAiDeepResearch.create.create;
```

## Related Documentation

For detailed examples and troubleshooting, see [Convex Nested Functions Access Patterns](./convex-nested-functions.md).
