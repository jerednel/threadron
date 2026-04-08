import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db } from "./db/connection.js";
import { authMiddleware } from "./middleware/auth.js";
import { authPublicRoutes, authProtectedRoutes } from "./routes/auth.js";
import { domainRoutes } from "./routes/domains.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { contextRoutes } from "./routes/context.js";
import { agentRoutes } from "./routes/agents.js";
import { configRoutes } from "./routes/config.js";

const app = new Hono();

app.use("/*", cors());

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Root route
app.get("/", (c) =>
  c.json({
    name: "Tasks for Agents",
    version: "0.1.0",
    api: "/v1",
    health: "/v1/health",
    docs: "https://github.com/jerednel/tasksforagents",
  })
);

// V1 API
const v1 = new Hono();

// Public routes
v1.get("/health", (c) => c.json({ status: "ok" }));
v1.route("/auth", authPublicRoutes(db));

// Protected routes
const protected_ = new Hono();
protected_.use("/*", authMiddleware(db));
protected_.route("/auth", authProtectedRoutes(db));
protected_.route("/domains", domainRoutes(db));
protected_.route("/projects", projectRoutes(db));
protected_.route("/tasks", taskRoutes(db));
protected_.route("/tasks", contextRoutes(db));
protected_.route("/agents", agentRoutes(db));
protected_.route("/config", configRoutes(db));

v1.route("/", protected_);
app.route("/v1", v1);

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
