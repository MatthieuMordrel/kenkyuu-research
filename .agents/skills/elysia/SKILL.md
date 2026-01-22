---
name: elysia
description: Use when building backend APIs with Elysia. Covers route creation with method chaining, Zod validation, Eden Treaty client integration, TanStack Query integration, and best practices for type-safe API development.
updated: 2026-01-20
keywords: elysia, bun, backend, api, zod, validation, eden-treaty, type-safety
---

# Elysia - Complete Guide

**Elysia** is the Bun-first web framework used for the backend API in this project. It provides excellent TypeScript inference, automatic type generation for Eden Treaty clients, and seamless integration with Zod for runtime validation. This guide covers production-ready patterns for building type-safe APIs.

## Core Principles

**Key principles for Elysia development:**

1. **Always use method chaining** - Critical for Eden type generation
2. **Validate everything** - Use Zod for request body and query parameters
3. **Export types** - Make validation schemas reusable across client/server
4. **Type-safe client** - Use Eden Treaty for end-to-end type safety

**Critical**: Always export `export type App = typeof app;` at the end of your main server file. This enables Eden Treaty to infer all route types automatically.

## Route Creation with Method Chaining

**⚠️ CRITICAL RULE**: Always use method chaining when defining routes. This ensures proper Eden type generation.

```typescript
// ✅ Correct - generates Eden types
export const myRoute = new Elysia()
  .get("/path", async ({ query }) => {
    return { message: "Hello" };
  })
  .post("/path", async ({ body }) => {
    return { success: true };
  });

// ❌ Wrong - breaks Eden type inference
export const myRoute = new Elysia();
myRoute.get("/path", async ({ query }) => {
  return { message: "Hello" };
});
```

**Why method chaining matters:**

- Eden Treaty analyzes the Elysia instance type to generate client types
- Breaking the chain prevents TypeScript from inferring the full route structure
- Method chaining preserves the type information through the chain

## Zod Validation

**Always validate request body and query parameters using Zod:**

```typescript
import { Elysia, t } from "elysia";
import { z } from "zod";

// Define Zod schemas
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

const getUserQuerySchema = z.object({
  id: z.string().uuid(),
  includeDeleted: z.boolean().optional().default(false),
});

// Export types for client-side use
export type CreateUserBody = z.infer<typeof createUserSchema>;
export type GetUserQuery = z.infer<typeof getUserQuerySchema>;

// Create route with validation
export const userRoutes = new Elysia()
  .post(
    "/users",
    async ({ body }) => {
      // body is fully typed as CreateUserBody
      const user = await createUser(body);
      return { id: user.id, name: user.name, email: user.email };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
        age: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )
  .get(
    "/users/:id",
    async ({ params, query }) => {
      // params.id is typed as string
      // query is typed based on query schema
      const user = await getUserById(params.id, query);
      return user;
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        includeDeleted: t.Optional(t.Boolean()),
      }),
    }
  );
```