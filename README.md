# Base Repo

A monorepo template with Elysia, Convex, and TanStack Router.

## Quick Install

```bash
gh repo clone "https://github.com/MatthieuMordrel/base-repo"
cd base-repo
bun install
bun run setup
```

```bash
bun run dev
```

## Tech Stack

- **Convex** - Real-time backend-as-a-service
- **TanStack Router** - Type-safe React router
- **TanStack Query** - Async state management
- **Zustand** - Client state management
- **shadcn/ui + Base UI** - Accessible UI components
- **Tailwind CSS v4** - Utility-first CSS
- **Bun** - Package manager and runtime
- **Elysia** - Bun-first web framework for the API

## Default Ports

| Service | Port | Description              |
| ------- | ---- | ------------------------ |
| Web     | 3000 | TanStack Router frontend |
| Elysia  | 3001 | API server               |
| Convex  | 3210 | Convex dev server        |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Node.js](https://nodejs.org) (v18+ for Convex CLI)

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

## Convex

Convex is the main database and backend functions provider. It is set up but not initialized. The schema should be defined and updated in `packages/convex/convex/schema.ts`.

## Data Fetching (TanStack Query)

Use TanStack Query for server state management:

## Client State (Zustand)

Use Zustand for client-side state management:

## Elysia and Eden Treaty (Type-safe API calls)

Elysia is the fallback API provider for the web app. It has a pre-configured Eden client for type-safe API calls to the Elysia server:

```typescript
import { api } from "@/lib/api";

// Fully type-safe API calls
const { data } = await api.get(); // GET /
const { data } = await api.health.get(); // GET /health
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

### Pre-installed components

- `button` - Button with variants
- `input` - Text input
- `dialog` - Modal dialog
- `card` - Card container

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
