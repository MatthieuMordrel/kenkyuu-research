# Base Repo

A monorepo template with Convex and TanStack Router.

## Quick Install

```bash
gh repo clone "https://github.com/MatthieuMordrel/base-repo"
cd base-repo
```

```bash
bun run setup
```

This will:

- Unlink the template remote (so you can create your own remote repository)
- Prompt for a new project name and package scope
- Create `.env` files from `.env.example` templates
- Install all dependencies
- Initialize Convex (opens browser for authentication)
- Optionally reset git history to a fresh "Initial commit"
- Rename the folder to match the project name

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

## Default Ports

| Service | Port | Description              |
| ------- | ---- | ------------------------ |
| Web     | 3000 | TanStack Router frontend |
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

## Convex Backend & Database

Convex is the main database and backend functions provider. The schema should be defined in `packages/convex/convex/schema.ts`.

```typescript
// Import the generated API
import { api } from "@repo/convex";

// Use Convex hooks in your components
import { useQuery, useMutation } from "convex/react";

function MyComponent() {
  const data = useQuery(api.myModule.myQuery);
  const doSomething = useMutation(api.myModule.myMutation);
}
```

## Data Fetching (TanStack Query)

When data doesn't live in Convex, use TanStack Query for server state management

## Client State (Zustand)

Use Zustand for all client-side state management

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

### Convex

The deployment URL (`CONVEX_URL`) is automatically configured in `packages/convex/.env.local` when you run setup or `bun run dev:convex`.

To set environment variables for your Convex functions (secrets, API keys, etc.):

```bash
cd packages/convex
bunx convex env set MY_SECRET "secret-value"
```

Or via the [Convex Dashboard](https://dashboard.convex.dev) → Your project → Settings → Environment Variables.
