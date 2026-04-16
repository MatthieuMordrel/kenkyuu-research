# Add Service API Key Authentication to a Convex Project

## Goal

Add a service API key mechanism so that auth-gated Convex functions can be called from non-browser contexts (CLI via `convex run`, LLM agents, scripts) without needing a user session.

## Context

Convex has no built-in service token mechanism. The recommended M2M pattern is a shared secret stored as a Convex environment variable. This prompt implements that pattern by extending the existing auth helper to accept a service key as an alternative to a session token.

**Caveat**: Function arguments are visible in the Convex dashboard logs, so the service key will appear there. This is acceptable for single-user apps and dev/CLI usage. For multi-tenant production apps, consider using HTTP actions with the key in headers instead.

## Instructions

### 1. Find the auth helper

Search the codebase for the function that validates authentication (e.g., `requireAuth`, `validateSession`, or similar). It is typically in a file like `authHelpers.ts`, `auth.ts`, or `lib/auth.ts` inside the `convex/` directory. Read and understand how it currently validates tokens (session table lookup, JWT check, Clerk/Auth0, etc.).

### 2. Set the environment variable

Run the following command to set a service API key on the Convex deployment:

```bash
npx convex env set SERVICE_API_KEY "<generate-a-random-64-char-hex-string>"
```

You can generate a key with: `openssl rand -hex 32`

### 3. Modify the auth helper

Add a service key check **before** the existing auth logic. The service key should be checked first as a fast path — if it matches, skip all session/JWT validation and return immediately.

**Pattern:**

```typescript
// At the top of the auth validation function, before any session/JWT checks:
const serviceKey = process.env.SERVICE_API_KEY;
if (serviceKey && token === serviceKey) {
  return; // Authorized via service key, skip session validation
}

// ... existing session/JWT validation continues below ...
```

**Important rules:**

- Do NOT remove or modify the existing auth logic — only prepend the service key check
- The service key check must use a constant-time comparison if available, but for single-user apps a simple `===` is acceptable
- If `SERVICE_API_KEY` env var is not set, the check is skipped entirely (no behavior change)
- The service key should work anywhere a `token` argument is already accepted — no new arguments needed

### 4. Verify it works

Test by calling an auth-gated function via the CLI:

```bash
npx convex run <module>:<function> '{"token": "<your-service-key>", ...other args}'
```

Also verify that normal session-based auth still works (the service key check should not interfere).

### 5. Document the key

Add a note to the project's CLAUDE.md or README that `SERVICE_API_KEY` can be used as the `token` argument to call any auth-gated function from the CLI. Example:

```
## CLI Access

Auth-gated functions can be called from the CLI using the service API key:
npx convex run module:function '{"token": "$SERVICE_API_KEY"}'
The key is stored as a Convex environment variable.
```

## Usage after implementation

```bash
# List research jobs from CLI
npx convex run researchJobs:listJobs '{"token": "your-service-key", "status": "completed", "limit": 5}'

# Call any auth-gated function
npx convex run anyModule:anyFunction '{"token": "your-service-key", ...}'
```
