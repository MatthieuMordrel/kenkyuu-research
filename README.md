# Base Repo

A monorepo template with Elysia, Convex, and TanStack Router.

## Tech Stack

- **Elysia** - Bun-first web framework for the API
- **Convex** - Real-time backend-as-a-service
- **TanStack Router** - Type-safe React router
- **Bun** - Package manager and runtime

## Default Ports

| Service | Port | Description |
|---------|------|-------------|
| Web     | 3000 | TanStack Router frontend |
| Elysia  | 3001 | API server |
| Convex  | 3210 | Convex dev server |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Node.js](https://nodejs.org) (v18+ for Convex CLI)

### Quick Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd base-repo

# Run the setup script (installs deps + initializes Convex)
./scripts/setup.sh
```

### Manual Setup

```bash
# Install dependencies
bun install

# Initialize Convex (will prompt for authentication)
cd packages/convex
bunx convex dev --once
cd ../..
```

### Kill zombie processes

If you encounter `EADDRINUSE` errors:

```bash
./scripts/kill-dev-ports.sh
```

## Using Shared Packages

### Utils

```typescript
import { formatDate, sleep, isNonNullable } from "@repo/utils";
```

### Brand Colors

```typescript
// TypeScript
import { colors } from "@repo/brand-colors";

// CSS
import "@repo/brand-colors/css";
```

### Eden Client (Type-safe API calls)

The web app has a pre-configured Eden client for type-safe API calls to the Elysia server:

```typescript
import { api } from "@/lib/api";

// Fully type-safe API calls
const { data } = await api.index.get();    // GET /
const { data } = await api.health.get();   // GET /health
```

## Convex

Convex is set up but not initialized. The schema is at `packages/convex/convex/schema.ts`.

### Define your schema

```typescript
// packages/convex/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }).index("by_email", ["email"]),
});
```

### Start the Convex dev server

```bash
bun run dev:convex
```

## Build

```bash
# Build web app
bun run build:web
```

## Environment Variables

### Web App (`apps/web/.env`)

```env
VITE_API_URL=localhost:3001
```

See `apps/web/.env.example` for reference.
