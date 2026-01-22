# Development Ports

## Overview

We develop in **WSL2** (Linux) while using a **Windows** browser. Two systems handle localhost forwarding:

1. **WSL2 built-in forwarding**: Automatically routes `localhost:XXXX` from Windows to WSL. Works transparently — no configuration needed.

2. **VS Code/Cursor port forwarding**: Creates explicit forwarding rules (visible in the Ports panel). Spawns `wslrelay.exe` processes on Windows.

These two systems can conflict, causing port number mismatches.

---

## Known Quirks

### Terminal link redirects to wrong port

When clicking a `localhost:5173` link in the terminal, Cursor may open `localhost:5174` instead.

**Why:** Clicking triggers Cursor's port forwarding, which conflicts with WSL2's built-in forwarding. Both try to bind to the same Windows port, so Cursor picks the next available one.

**Workaround:** Type the URL manually or bookmark it. The correct port (e.g., `localhost:5173`) works fine when accessed directly — WSL2's built-in forwarding handles it.

### Zombie processes cause `EADDRINUSE` errors

When you `Ctrl+C` to stop the dev server, sometimes processes don't terminate properly.

**Solution:** Run `pnpm run kill-ports` before starting, or use `pnpm run dev` which will kill any zombie processes when starting the dev server.

---

## Port Assignments

| App           | Port | Description                                  |
| ------------- | ---- | -------------------------------------------- |
| **marketing** | 3000 | TanStack Start marketing site (Vite + Nitro) |
| **convex**    | 3210 | Convex dev server (default)                  |
| **sanity**    | 3333 | Sanity Studio (default)                      |
| **elysia**    | 4000 | Elysia API server (Bun)                      |
| **email**     | 4321 | React Email preview server                   |
| **frontend**  | 5173 | Main React SPA (Vite)                        |
| **trigger**   | 8080 | Trigger.dev dev server                       |
| **backend**   | 8787 | Hono API server (Bun)                        |

---

## Dev Commands & Their Ports

### `pnpm run dev` (default)

- backend: 8787
- frontend: 5173
- marketing: 3000
- convex: 3210
- elysia: 4000

### `pnpm run dev:mail`

Same as `dev` but replaces `elysia` with `email`:

- backend: 8787
- frontend: 5173
- marketing: 3000
- convex: 3210
- email: 4321

### `pnpm run dev:blog`

Same as `dev` but adds `sanity`:

- backend: 8787
- frontend: 5173
- marketing: 3000
- convex: 3210
- sanity: 3333

### `pnpm run dev:trigger`

Same as `dev` but adds `trigger`:

- backend: 8787
- frontend: 5173
- marketing: 3000
- convex: 3210
- trigger: 8080

### `pnpm run dev:full`

All services:

- backend: 8787
- frontend: 5173
- marketing: 3000
- convex: 3210
- email: 4321
- sanity: 3333
- trigger: 8080

---

## Cleanup

### Kill zombie processes (WSL)

```bash
pnpm run kill-ports
```

### Start fresh (kill + dev)

```bash
pnpm run dev
```

### Full reset (if ports are really stuck)

1. Stop all dev servers
2. Clear VS Code Ports panel (remove all entries)
3. In PowerShell (Windows): `wsl --shutdown`
4. Reopen terminal and run `pnpm run dev`
