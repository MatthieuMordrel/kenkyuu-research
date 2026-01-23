import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
// Configuration from environment variables
const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const app = new Elysia()
    .use(cors({
    origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}))
    .get("/", () => "Hello Elysia")
    .get("/health", () => ({ status: "ok" }));
// Start server
app.listen(PORT);
console.log(`🦊 Elysia is running at http://localhost:${PORT}`);
console.log(`   CORS allowed origins: ${CORS_ORIGIN}`);
