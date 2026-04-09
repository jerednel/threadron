import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function toApi(row: typeof agents.$inferSelect) {
  // Strip userId prefix from the internal scoped ID
  const externalId = row.id.includes(":") ? row.id.split(":").slice(1).join(":") : row.id;
  return {
    id: externalId,
    name: row.name,
    type: row.type,
    capabilities: row.capabilities,
    last_seen: row.lastSeen,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function agentRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Register agent (agent supplies its own ID)
  router.post("/", async (c) => {
    const body = await c.req.json<{
      id: string;
      name: string;
      type?: string;
      capabilities?: unknown;
    }>();
    const userId: string = c.get("userId") as string;

    // Use userId-scoped ID to avoid cross-tenant collisions
    const agentId = `${userId}:${body.id}`;

    // Check if this agent already exists for this user — upsert
    const [existing] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
      .limit(1);

    if (existing) {
      // Update existing agent
      const [row] = await db
        .update(agents)
        .set({
          name: body.name,
          type: body.type ?? existing.type,
          capabilities: body.capabilities ?? existing.capabilities,
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId))
        .returning();
      return c.json(toApi(row), 200);
    }

    const [row] = await db
      .insert(agents)
      .values({
        id: agentId,
        name: body.name,
        type: body.type ?? "generic",
        userId,
        capabilities: body.capabilities ?? null,
        lastSeen: new Date(),
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List agents (scoped to user)
  router.get("/", async (c) => {
    const userId: string = c.get("userId") as string;
    const rows = await db.select().from(agents).where(eq(agents.userId, userId));
    return c.json({ agents: rows.map(toApi) });
  });

  // GET /:id — Get single agent
  router.get("/:id", async (c) => {
    const rawId = c.req.param("id");
    const userId: string = c.get("userId") as string;
    // Try scoped ID first, then raw ID for backwards compatibility
    const scopedId = rawId.includes(":") ? rawId : `${userId}:${rawId}`;
    const rows = await db.select().from(agents)
      .where(and(eq(agents.id, scopedId), eq(agents.userId, userId))).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0]));
  });

  // PATCH /:id — Update agent
  router.patch("/:id", async (c) => {
    const rawId = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const id = rawId.includes(":") ? rawId : `${userId}:${rawId}`;
    const body = await c.req.json<{
      name?: string;
      type?: string;
      capabilities?: unknown;
      last_seen?: string;
    }>();

    const existing = await db.select().from(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId))).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const updates: Partial<typeof agents.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.capabilities !== undefined) updates.capabilities = body.capabilities;
    if (body.last_seen !== undefined) updates.lastSeen = new Date(body.last_seen);

    const [row] = await db
      .update(agents)
      .set(updates)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .returning();

    return c.json(toApi(row));
  });

  return router;
}
