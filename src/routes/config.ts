import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { config } from "../db/schema.js";
import { eq } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function toApi(row: typeof config.$inferSelect) {
  return {
    key: row.key,
    value: row.value,
    updated_at: row.updatedAt,
  };
}

export function configRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Set/upsert config entry
  router.post("/", async (c) => {
    const body = await c.req.json<{ key: string; value: unknown }>();

    const [row] = await db
      .insert(config)
      .values({
        key: body.key,
        value: body.value,
      })
      .onConflictDoUpdate({
        target: config.key,
        set: {
          value: body.value,
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List all config entries
  router.get("/", async (c) => {
    const rows = await db.select().from(config);
    return c.json({ config: rows.map(toApi) });
  });

  // GET /:key — Get single config entry
  router.get("/:key", async (c) => {
    const key = c.req.param("key");
    const rows = await db.select().from(config).where(eq(config.key, key)).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0]));
  });

  // PATCH /:key — Update config entry
  router.patch("/:key", async (c) => {
    const key = c.req.param("key");
    const body = await c.req.json<{ value: unknown }>();

    const existing = await db.select().from(config).where(eq(config.key, key)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const [row] = await db
      .update(config)
      .set({ value: body.value, updatedAt: new Date() })
      .where(eq(config.key, key))
      .returning();

    return c.json(toApi(row));
  });

  return router;
}
