---
name: convex
description: Use when working with Convex database and backend functions. Covers nested function access patterns for queries, mutations, and actions with proper TypeScript type resolution.
updated: 2026-01-23
keywords: convex, database, queries, mutations, actions, nested-functions, type-safety
---

# Convex - Complete Guide

**Convex** is the real-time backend-as-a-service used for database operations in this project. This guide covers essential patterns for accessing nested Convex functions with proper TypeScript type resolution.

## Essential Reading

**Always consult the official [Convex best practices](https://docs.convex.dev/understanding/best-practices/).**

Key topics: await all promises, avoid `.filter` (use indexes), use `.collect` only with small result sets, argument validation, access control, helper functions, avoiding sequential `ctx.runMutation`/`ctx.runQuery` in actions.

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

### Wrong: Single name

```typescript
// This will cause TypeScript errors
api.queries.jobs.list;
internal.mutations.openAiDeepResearch.create;
```

### Wrong: Missing bracket notation for internal queries

```typescript
// This will cause TypeScript error TS4111
internal.queries.openAiDeepResearch.getById.getById;
```

### Correct: Full pattern

```typescript
// Public queries
api.queries.jobs.list.list;

// Internal queries (note bracket notation)
internal.queries["openAiDeepResearch"].getById.getById;

// Internal mutations/actions
internal.mutations.openAiDeepResearch.create.create;
```

## Convex Runtime

Convex uses its **own lightweight runtime** by default, which does not include Node.js APIs. When you need Node.js built-in modules (e.g., `crypto`, `fs`, `Buffer`) or npm packages that depend on them, add the `"use node"` directive at the top of your action file:

```typescript
"use node";

import { internalAction } from "./_generated/server";
import crypto from "crypto";
```

**Note**: Only **actions** support `"use node"`. Queries and mutations always run in the Convex runtime.

## Security Best Practices

### Prefer Internal Functions

**Public functions (`query`, `mutation`, `action`) are callable by anyone** with your deployment URL. Always favor internal variants when functions should only be called server-side:

| Use Case              | Use                             | Avoid      |
| --------------------- | ------------------------------- | ---------- |
| Client-facing API     | `query`/`mutation`              | -          |
| Server-to-server call | `internalQuery`                 | `query`    |
| Background job        | `internalAction`                | `action`   |
| Scheduler/cron task   | `internalMutation`              | `mutation` |
| Webhook handler       | `httpAction` + `internalAction` | `action`   |

### Avoid Calling Actions Directly from Clients

**Calling an action directly from a client is an anti-pattern.** Instead, have the client call a mutation that captures user intent by writing to the database, then schedules an action:

```typescript
// ❌ Anti-pattern: client calls action directly
const performAction = useAction(api.myFunctions.doSomething);

// ✅ Correct: client calls mutation that schedules action
export const requestTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const taskId = await ctx.db.insert("tasks", { text, status: "pending" });
    await ctx.scheduler.runAfter(0, internal.myFunctions.processTask, {
      taskId,
    });
    return taskId;
  },
});
```

**Benefits**: The mutation enforces invariants (e.g., preventing duplicate actions), provides an audit trail, and allows the UI to show pending state immediately.

### Key Rules

- **Never expose sensitive operations** via public `action`/`mutation` - use `internalAction`/`internalMutation`.
- **Validate all inputs** in public functions; internal functions can trust their callers.
- **Use `ctx.runMutation`/`ctx.runQuery`** inside actions to call internal functions safely.
- **HTTP endpoints** should validate auth/signatures before calling internal functions.
