import { treaty } from "@elysiajs/eden";
const API_URL = import.meta.env.VITE_API_URL || "localhost:3001";
// Create the Eden Treaty client with full type safety
export const api = treaty(API_URL);
