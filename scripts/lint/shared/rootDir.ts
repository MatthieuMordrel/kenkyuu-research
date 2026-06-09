/**
 * Shared repo-root and Convex package path resolution for lint-script rules.
 */
import { join } from "node:path";

/**
 * The monorepo root directory, resolved relative to this module's own
 * location. This file lives at `scripts/lint/shared/rootDir.ts`, so three
 * `..` segments climb back to the repository root. Because the path is
 * resolved from this module's `import.meta.dirname` (not the caller's),
 * every lint rule that imports `REPO_ROOT` gets the same stable root.
 */
export const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** The `packages/convex` package directory (the Convex workspace package root). */
export const CONVEX_PACKAGE_DIR = join(REPO_ROOT, "packages", "convex");
