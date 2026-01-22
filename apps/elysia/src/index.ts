import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/health", () => ({ status: "ok" }));

// Export the app type for Eden client
export type App = typeof app;

// Start server
app.listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
