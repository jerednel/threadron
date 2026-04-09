import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db } from "./db/connection.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authPublicRoutes, authProtectedRoutes } from "./routes/auth.js";
import { userPublicRoutes, userProtectedRoutes } from "./routes/users.js";
import { domainRoutes } from "./routes/domains.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { contextRoutes } from "./routes/context.js";
import { artifactRoutes, artifactLookupRoutes } from "./routes/artifacts.js";
import { agentRoutes } from "./routes/agents.js";
import { configRoutes } from "./routes/config.js";
import { waitlistRoutes } from "./routes/waitlist.js";

const app = new Hono();

app.use("/*", cors());
app.use("/*", rateLimit(60000, 200)); // 200 requests per minute

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// V1 API
const v1 = new Hono();

// Public routes
v1.get("/health", (c) => c.json({ status: "ok" }));
v1.route("/auth", authPublicRoutes(db));
v1.route("/users", userPublicRoutes(db));
v1.route("/waitlist", waitlistRoutes(db));

// JWT-protected user routes
v1.route("/users", userProtectedRoutes(db));

// API-key protected routes
const protected_ = new Hono();
protected_.use("/*", authMiddleware(db));
protected_.route("/auth", authProtectedRoutes(db));
protected_.route("/domains", domainRoutes(db));
protected_.route("/projects", projectRoutes(db));
protected_.route("/tasks", taskRoutes(db));
protected_.route("/tasks", contextRoutes(db));
protected_.route("/tasks", artifactRoutes(db));
protected_.route("/artifacts", artifactLookupRoutes(db));
protected_.route("/agents", agentRoutes(db));
protected_.route("/config", configRoutes(db));

v1.route("/", protected_);
app.route("/v1", v1);

// Serve dashboard SPA at /dashboard/
app.use("/dashboard/*", serveStatic({ root: "./dashboard/dist", rewriteRequestPath: (path) => path.replace(/^\/dashboard/, '') }));
app.get("/dashboard", (c) => c.redirect("/dashboard/"));
// SPA fallback — serve index.html for all dashboard routes
app.use("/dashboard/*", serveStatic({ root: "./dashboard/dist", path: "index.html" }));

// Serve marketing site at root (after API routes so API takes priority)
app.use("/*", serveStatic({ root: "./site" }));

const port = parseInt(process.env.PORT || "8080");
const host = process.env.HOST || "0.0.0.0";

async function runMigrationsWithRetry(maxRetries = 10, delayMs = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Running database migrations (attempt ${i + 1}/${maxRetries})...`);
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("Migrations complete.");
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "CONNECT_TIMEOUT" || code === "ECONNREFUSED") {
        console.log(`Database not ready, retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Database not reachable after max retries");
}

if (!process.env.VITEST) {
  // Start server immediately so health checks pass
  serve({ fetch: app.fetch, port, hostname: host });
  console.log(`AgentTask API running on http://${host}:${port}`);

  // Run migrations in background — DB routes will fail until complete
  runMigrationsWithRetry().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}

export { app, v1 };
