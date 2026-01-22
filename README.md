# Base Repo

A monorepo template with Elysia, Convex, and TanStack Router.

## Tech Stack

- **Elysia** - Bun-first web framework for the API
- **Convex** - Real-time backend-as-a-service
- **TanStack Router** - Type-safe React router
- **TanStack Query** - Async state management
- **Zustand** - Client state management
- **shadcn/ui + Base UI** - Accessible UI components
- **Tailwind CSS v4** - Utility-first CSS
- **Bun** - Package manager and runtime

## Structure

```
base-repo/
├── apps/
│   ├── elysia/           # @repo/elysia - API server
│   │   └── src/
│   └── web/              # TanStack Router frontend
│       ├── src/
│       │   ├── components/ui/  # shadcn/ui components
│       │   ├── lib/            # Utilities (api client, cn)
│       │   └── routes/         # File-based routes
│       └── components.json     # shadcn config
├── packages/
│   ├── convex/           # @repo/convex - Convex backend
│   ├── utils/            # @repo/utils - Shared utilities
│   └── brand-colors/     # @repo/brand-colors - Brand colors
└── scripts/
    ├── setup.sh          # Initial setup
    └── kill-dev-ports.sh # Kill zombie processes
```

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
const { data } = await api.get();           // GET /
const { data } = await api.health.get();    // GET /health
```

## Data Fetching (TanStack Query)

Use TanStack Query for server state management:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function MyComponent() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.health.get();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>Status: {data.status}</div>;
}
```

## Client State (Zustand)

Use Zustand for client-side state management:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CounterState {
  count: number;
  increment: () => void;
}

export const useCounterStore = create<CounterState>()(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    { name: "counter-store" }
  )
);

// In a component
function Counter() {
  const { count, increment } = useCounterStore();
  return <button onClick={increment}>{count}</button>;
}
```

## UI Components (shadcn + Base UI)

The web app uses [shadcn/ui](https://ui.shadcn.com) with [Base UI](https://base-ui.com) primitives via the [@basecn](https://basecn.dev) registry.

### Add components

```bash
cd apps/web

# Add from Base UI registry
bunx shadcn@latest add @basecn/button
bunx shadcn@latest add @basecn/dialog
bunx shadcn@latest add @basecn/input

# Or use the direct URL
bunx shadcn@latest add https://basecn.dev/r/card.json
```

### Use components

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

### Pre-installed components

- `button` - Button with variants
- `input` - Text input
- `dialog` - Modal dialog
- `card` - Card container

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

### Elysia API (`apps/elysia/.env`)

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

For multiple CORS origins, use comma-separated values:
```env
CORS_ORIGIN=http://localhost:3000,https://myapp.com
```

See `.env.example` files in each app for reference.
