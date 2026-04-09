import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function toApi(row: typeof agents.$inferSelect) {
  return {
    id: row.id,
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

    const [row] = await db
      .insert(agents)
      .values({
        id: body.id,
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
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const rows = await db.select().from(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId))).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0]));
  });

  // PATCH /:id — Update agent
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
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
