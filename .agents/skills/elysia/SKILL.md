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

## Server Setup

**Basic Elysia server configuration:**

```typescript
// apps/elysia/src/index.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const app = new Elysia()
  .use(
    cors({
      origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }));

// Export the app type for Eden client
export type App = typeof app;

// Start server
app.listen(PORT);
```

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

**Using Zod with Elysia's type system:**

Elysia uses its own type system (`t.*`) for validation, but you can use Zod schemas and convert them:

```typescript
import { Elysia, t } from "elysia";
import { z } from "zod";

// Define with Zod for reusability
const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

// Convert to Elysia type (or use Zod plugin)
export const postRoutes = new Elysia()
  .post(
    "/posts",
    async ({ body }) => {
      // Validate with Zod
      const validated = createPostSchema.parse(body);
      const post = await createPost(validated);
      return post;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        content: t.String({ minLength: 10 }),
        tags: t.Optional(t.Array(t.String())),
      }),
    }
  );

// Export type for client
export type CreatePostBody = z.infer<typeof createPostSchema>;
```

**Best practice**: Use Elysia's `t.*` types for route validation (better performance), but keep Zod schemas for shared type definitions and export them for client-side use.

## Route Organization

**Organize routes by feature, not by HTTP method:**

```text
apps/elysia/src/
├── index.ts              # Main app, imports all routes
├── routes/
│   ├── users.ts          # All user-related routes
│   ├── posts.ts          # All post-related routes
│   └── auth.ts           # Authentication routes
└── lib/
    ├── db.ts             # Database utilities
    └── validation.ts     # Shared validation schemas
```

**Example route file:**

```typescript
// apps/elysia/src/routes/users.ts
import { Elysia, t } from "elysia";
import { z } from "zod";

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const getUserQuerySchema = z.object({
  includePosts: z.boolean().optional().default(false),
});

// Export types
export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type GetUserQuery = z.infer<typeof getUserQuerySchema>;

// Route definitions
export const userRoutes = new Elysia({ prefix: "/users" })
  .get(
    "/",
    async ({ query }) => {
      const users = await getUsers(query);
      return { users };
    },
    {
      query: t.Object({
        includePosts: t.Optional(t.Boolean()),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params }) => {
      const user = await getUserById(params.id);
      return user;
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  )
  .post(
    "/",
    async ({ body }) => {
      const user = await createUser(body);
      return { id: user.id, ...user };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
      }),
    }
  )
  .put(
    "/:id",
    async ({ params, body }) => {
      const user = await updateUser(params.id, body);
      return user;
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        email: t.Optional(t.String({ format: "email" })),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params }) => {
      await deleteUser(params.id);
      return { success: true };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
```

**Compose routes in main app:**

```typescript
// apps/elysia/src/index.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { userRoutes } from "./routes/users";
import { postRoutes } from "./routes/posts";
import { authRoutes } from "./routes/auth";

const app = new Elysia()
  .use(cors({ /* ... */ }))
  .get("/health", () => ({ status: "ok" }))
  .use(userRoutes)
  .use(postRoutes)
  .use(authRoutes);

export type App = typeof app;
app.listen(PORT);
```

## Eden Treaty Client

**The Eden Treaty client provides end-to-end type safety:**

```typescript
// apps/web/src/lib/api.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/elysia";

const API_URL = import.meta.env.VITE_API_URL || "localhost:3001";

// Create the Eden Treaty client with full type safety
export const api = treaty<App>(API_URL);

// Re-export the type for use elsewhere if needed
export type { App };
```

**Using the Eden client:**

```typescript
import { api } from "@/lib/api";

// GET request - fully typed
const { data, error } = await api.users.get({
  query: {
    includePosts: true,
  },
});

if (error) {
  console.error(error);
  return;
}

// data is fully typed based on route return type
console.log(data.users);

// POST request - body is validated and typed
const { data: newUser, error: createError } = await api.users.post({
  body: {
    name: "John Doe",
    email: "john@example.com",
  },
});

// PUT request with params
const { data: updatedUser } = await api.users({ id: "uuid-here" }).put({
  body: {
    name: "Jane Doe",
  },
});

// DELETE request
const { data: result } = await api.users({ id: "uuid-here" }).delete();
```

**Error handling:**

```typescript
const { data, error } = await api.users.post({
  body: {
    name: "John",
    email: "invalid-email", // Will be caught by validation
  },
});

if (error) {
  // error.value contains validation errors or HTTP errors
  if (error.status === 400) {
    console.error("Validation error:", error.value);
  } else if (error.status === 500) {
    console.error("Server error:", error.value);
  }
}
```

## TanStack Query Integration

**Wrap Eden methods with TanStack Query for server state management:**

```typescript
// apps/web/src/lib/queries/users.ts
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GetUserQuery, CreateUserBody } from "@repo/elysia/routes/users";

// Query options for fetching users
export function usersQueryOptions(query?: GetUserQuery) {
  return queryOptions({
    queryKey: ["users", query],
    queryFn: async () => {
      const { data, error } = await api.users.get({ query });
      if (error) throw error;
      return data;
    },
  });
}

// Custom hook
export function useUsers(query?: GetUserQuery) {
  return useQuery(usersQueryOptions(query));
}

// Mutation for creating user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateUserBody) => {
      const { data, error } = await api.users.post({ body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// Mutation for updating user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Partial<CreateUserBody>;
    }) => {
      const { data, error } = await api.users({ id }).put({ body });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate specific user and list
      queryClient.invalidateQueries({ queryKey: ["users", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
```

**Using in components:**

```typescript
// apps/web/src/routes/users.tsx
import { useUsers, useCreateUser } from "@/lib/queries/users";
import { useQuery } from "@tanstack/react-query";

function UsersPage() {
  const { data, isLoading, error } = useUsers({ includePosts: true });
  const createUser = useCreateUser();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleCreate = () => {
    createUser.mutate({
      name: "New User",
      email: "user@example.com",
    });
  };

  return (
    <div>
      <button onClick={handleCreate}>Create User</button>
      <ul>
        {data?.users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Type Exports

**Always export validation types for client-side use:**

```typescript
// apps/elysia/src/routes/users.ts
import { z } from "zod";

// Define schemas
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Export types - these can be imported on the client
export type CreateUserBody = z.infer<typeof createUserSchema>;
export type CreateUserResponse = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};
```

**Client-side usage:**

```typescript
// apps/web/src/lib/queries/users.ts
import type { CreateUserBody } from "@repo/elysia/routes/users";

// Now you have type safety on the client
const body: CreateUserBody = {
  name: "John",
  email: "john@example.com",
};
```

**Package exports:**

Make sure your Elysia package exports route types:

```json
// apps/elysia/package.json
{
  "name": "@repo/elysia",
  "exports": {
    ".": "./src/index.ts",
    "./routes/users": "./src/routes/users.ts"
  }
}
```

## Error Handling

**Elysia provides built-in error handling:**

```typescript
import { Elysia } from "elysia";

export const userRoutes = new Elysia({ prefix: "/users" })
  .get("/:id", async ({ params, error }) => {
    const user = await getUserById(params.id);

    if (!user) {
      return error(404, { message: "User not found" });
    }

    if (user.deleted) {
      return error(410, { message: "User has been deleted" });
    }

    return user;
  })
  .post("/", async ({ body, error }) => {
    try {
      const user = await createUser(body);
      return { id: user.id, ...user };
    } catch (err) {
      if (err instanceof ValidationError) {
        return error(400, { message: err.message, errors: err.errors });
      }
      return error(500, { message: "Internal server error" });
    }
  });
```

**Global error handler:**

```typescript
const app = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation failed",
        details: error.message,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Route not found",
      };
    }

    // Log unexpected errors
    console.error("Unexpected error:", error);

    set.status = 500;
    return {
      error: "Internal server error",
    };
  })
  .use(userRoutes);
```

## Authentication & Authorization

**Example authentication middleware:**

```typescript
// apps/elysia/src/lib/auth.ts
import { Elysia, t } from "elysia";

export const authPlugin = new Elysia()
  .derive(async ({ headers, error }) => {
    const token = headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return error(401, { message: "Unauthorized" });
    }

    try {
      const user = await verifyToken(token);
      return { user };
    } catch {
      return error(401, { message: "Invalid token" });
    }
  });

// Protected routes
export const protectedRoutes = new Elysia()
  .use(authPlugin)
  .get("/profile", async ({ user }) => {
    return { id: user.id, name: user.name, email: user.email };
  })
  .post("/posts", async ({ user, body }) => {
    const post = await createPost({ ...body, authorId: user.id });
    return post;
  });
```

## Best Practices

**1. Always use method chaining** - Required for Eden type generation

**2. Validate all inputs** - Use Elysia's `t.*` types or Zod schemas

**3. Export types** - Make validation types available to the client

**4. Organize by feature** - Group related routes together

**5. Use prefixes** - Organize routes with prefixes for better structure

**6. Handle errors gracefully** - Use Elysia's error handling utilities

**7. Keep routes focused** - Each route file should handle one resource/feature

## Anti-Patterns to Avoid

**❌ Don't break method chaining:**

```typescript
// ❌ Wrong - breaks Eden type inference
const app = new Elysia();
app.get("/path", handler);
app.post("/path", handler);

// ✅ Correct - method chaining
const app = new Elysia()
  .get("/path", handler)
  .post("/path", handler);
```

**❌ Don't skip validation:**

```typescript
// ❌ Wrong - no validation
.post("/users", async ({ body }) => {
  // body is 'any' - no type safety
  return createUser(body);
})

// ✅ Correct - with validation
.post(
  "/users",
  async ({ body }) => {
    // body is fully typed
    return createUser(body);
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      email: t.String({ format: "email" }),
    }),
  }
)
```

**❌ Don't forget to export the App type:**

```typescript
// ❌ Wrong - Eden client can't infer types
const app = new Elysia().get("/", () => "Hello");
app.listen(3001);

// ✅ Correct - export type for Eden
const app = new Elysia().get("/", () => "Hello");
export type App = typeof app;
app.listen(3001);
```

**❌ Don't use fetch directly on the client:**

```typescript
// ❌ Wrong - no type safety
const response = await fetch("/api/users", {
  method: "POST",
  body: JSON.stringify({ name: "John" }),
});

// ✅ Correct - use Eden client
const { data, error } = await api.users.post({
  body: { name: "John" },
});
```

**❌ Don't duplicate validation logic:**

```typescript
// ❌ Wrong - validation in handler
.post("/users", async ({ body }) => {
  if (!body.name || body.name.length < 1) {
    return error(400, "Name required");
  }
  // ...
})

// ✅ Correct - use Elysia validation
.post(
  "/users",
  async ({ body }) => {
    // body is already validated
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1 }),
    }),
  }
)
```

## Related Skills

- **tanstack-query** - Integrating Elysia routes with TanStack Query
- **convex** - Using Convex for database operations in Elysia routes
- **typescript** - Type-safe API development patterns
