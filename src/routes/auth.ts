import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { apiKeys } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq, and } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function generateApiKey(): string {
  return `tfa_sk_${genId("k")}`;
}

export function authPublicRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST /setup — First-run: create initial API key
  router.post("/setup", async (c) => {
    const existing = await db.select().from(apiKeys).limit(1);
    if (existing.length > 0) {
      return c.json({ error: "Setup already completed" }, 409);
    }

    const body = await c.req.json<{ name?: string }>();
    const name = body?.name ?? "default";

    const id = genId("key");
    const key = generateApiKey();

    await db.insert(apiKeys).values({ id, key, name });

    return c.json({ id, api_key: key, name }, 201);
  });

  return router;
}

export function authProtectedRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST /keys — Create additional API key (linked to user)
  router.post("/keys", async (c) => {
    const body = await c.req.json<{ name?: string; agent_id?: string }>();
    const name = body?.name ?? "unnamed";
    const agentId = body?.agent_id ?? null;
    const userId = c.get("userId") as string;

    const id = genId("key");
    const key = generateApiKey();

    await db.insert(apiKeys).values({ id, key, name, agentId, userId });

    return c.json({ id, api_key: key, name, agent_id: agentId }, 201);
  });

  // GET /keys — List API keys with redacted key values (scoped to user)
  router.get("/keys", async (c) => {
    const userId = c.get("userId") as string;
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));

    const keys = rows.map((row) => ({
      id: row.id,
      name: row.name,
      agent_id: row.agentId,
      key_prefix: row.key.slice(0, 16) + "...",
      created_at: row.createdAt,
    }));

    return c.json({ keys });
  });

  // DELETE /keys/:id — Revoke an API key (scoped to user)
  router.delete("/keys/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;

    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    return c.json({ success: true });
  });

  return router;
}

// Backwards-compatible export
export function authRoutes(db: DrizzleDb) {
  return authPublicRoutes(db);
}
