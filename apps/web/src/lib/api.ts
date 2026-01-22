import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/elysia";

const API_URL = import.meta.env.VITE_API_URL || "localhost:3001";

// Create the Eden Treaty client with full type safety
export const api = treaty<App>(API_URL);

// Re-export the type for use elsewhere if needed
export type { App };
