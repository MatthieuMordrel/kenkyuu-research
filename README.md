# Kenkyuu Research

An AI-powered stock research platform that enables deep analysis of stocks using customizable research prompts. Track your research history, manage stock portfolios, schedule automated research runs, and monitor costs with budget alerts.

## Features

- **Stock Management**: Organize stocks by ticker, exchange, sector, and custom tags
- **Research Prompts**: Create and manage reusable research templates (single-stock, multi-stock, or discovery mode)
- **AI-Powered Research**: Run research jobs using OpenAI to generate comprehensive stock analysis
- **Scheduled Research**: Automate research runs with cron-based scheduling and timezone support
- **Cost Tracking**: Monitor spending with monthly budgets and cost alerts
- **Research History**: View completed research runs with detailed results and metadata
- **Authentication**: Secure session-based authentication system

## Tech Stack

- **Frontend**: React 19, TypeScript, TanStack Router, TanStack Query, Zustand
- **UI**: Tailwind CSS v4, shadcn/ui (Base UI), Lucide React icons
- **Backend**: Convex (real-time database and backend functions)
- **Runtime**: Bun (package manager and runtime)
- **Linting**: oxlint, oxfmt

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Node.js](https://nodejs.org) (v18+ for Convex CLI)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd kenkyuu-research

# Run setup script
bun run setup
```

The setup script will:

- Create `.env` files from `.env.example` templates
- Install all dependencies
- Initialize Convex (opens browser for authentication)
- Optionally reset git history to a fresh "Initial commit"

### Development

```bash
# Start both web and Convex dev servers
bun run dev
```

This starts:

- **Web app** on `http://localhost:3000`
- **Convex dev server** on `http://localhost:3210`

### Kill Zombie Processes

If you encounter `EADDRINUSE` errors:

```bash
./scripts/kill-dev-ports.sh
```

## Project Structure

```
kenkyuu-research/
├── apps/
│   └── web/              # React frontend application
│       ├── src/
│       │   ├── components/   # React components
│       │   ├── hooks/        # Custom React hooks
│       │   ├── lib/          # Utility functions
│       │   └── routes/       # TanStack Router routes
│       └── public/           # Static assets
├── packages/
│   ├── convex/          # Convex backend functions and schema
│   ├── utils/           # Shared utility functions
│   └── brand-colors/    # Brand color definitions
└── scripts/             # Setup and utility scripts
```

## Default Ports

| Service | Port | Description              |
| ------- | ---- | ------------------------ |
| Web     | 3000 | TanStack Router frontend |
| Convex  | 3210 | Convex dev server        |

## Using Shared Packages

### Utils

```typescript
import { formatDate, sleep, isNonNullable } from '@repo/utils'
```

### Brand Colors

```typescript
// TypeScript
import { colors } from '@repo/brand-colors'

// CSS
import '@repo/brand-colors/css'
```

## Convex Backend & Database

Convex serves as both the database and backend. The schema is defined in `packages/convex/convex/schema.ts`.

### Using Convex in Components

```typescript
// Import the generated API
import { api } from '@repo/convex'

// Use Convex hooks in your components
import { useQuery, useMutation } from 'convex/react'

function MyComponent() {
  const data = useQuery(api.myModule.myQuery)
  const doSomething = useMutation(api.myModule.myMutation)
}
```

### Environment Variables

The deployment URL (`CONVEX_URL`) is automatically configured in `packages/convex/.env.local` when you run setup or `bun run dev:convex`.

To set environment variables for your Convex functions (secrets, API keys, etc.):

```bash
cd packages/convex
bunx convex env set MY_SECRET "secret-value"
```

Or via the [Convex Dashboard](https://dashboard.convex.dev) → Your project → Settings → Environment Variables.

## Data Fetching

- **Convex**: Primary data source - use Convex hooks (`useQuery`, `useMutation`) for data stored in Convex
- **TanStack Query**: Use for async state management when data doesn't live in Convex

## Client State (Zustand)

Use Zustand for all client-side state management (UI state, local preferences, etc.)

## UI Components (shadcn + Base UI)

The web app uses [shadcn/ui](https://ui.shadcn.com) with [Base UI](https://base-ui.com) primitives via the [@basecn](https://basecn.dev) registry.

### Add Components

```bash
cd apps/web

# Add from Base UI registry
bunx shadcn@latest add @basecn/button
bunx shadcn@latest add @basecn/dialog
bunx shadcn@latest add @basecn/input

# Or use the direct URL
bunx shadcn@latest add https://basecn.dev/r/card.json
```

### Pre-installed Components

- `button` - Button with variants
- `input` - Text input
- `dialog` - Modal dialog
- `card` - Card container
- `badge` - Badge component
- `label` - Form label
- `textarea` - Textarea input

## Development Scripts

```bash
# Development
bun run dev              # Start web and Convex dev servers
bun run dev:web          # Start only web dev server
bun run dev:convex       # Start only Convex dev server

# Building
bun run build:web        # Build web app for production

# Code Quality
bun run typecheck        # Type check all packages
bun run lint             # Lint all packages
bun run lint:fix         # Fix linting issues
bun run format            # Format code
bun run format:check      # Check code formatting

# Dependencies
bun run deps:check       # Check for outdated dependencies
bun run deps:update      # Update all dependencies
```

## Architecture

### Component Structure

- **main** – Renders the overall UI and layout
- **stateful** – Uses React Query/Zustand via custom hooks to fetch data and passes results to the UI layer
- **ui** – Receives props from the stateful component and renders presentational elements

### Data Fetching Strategy

- Fetch at the lowest level: Place data fetching in the stateful component, then pass data down to the UI component
- Component isolation: Avoid having multiple major components per file for maintainability

### URL State Management

- Manage shareable or persistent state (tabs, filters, pagination) with TanStack Router's URL search params
- Use `validateSearch` for parsing and validation
- Keep ephemeral/local UI state (open popovers, input search terms) in local component state

## Contributing

1. Follow the coding standards defined in `AGENTS.md`
2. Always run `bun run typecheck` and `bun run lint` before committing
3. Write detailed JSDoc comments for all functions and components
4. Keep components small and focused on a single responsibility
5. Use custom hooks for data fetching and state management

## License

[Add your license here]
