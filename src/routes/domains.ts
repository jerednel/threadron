import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { domains } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq, and } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function toApi(row: typeof domains.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    default_guardrail: row.defaultGuardrail,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function domainRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Create domain
  router.post("/", async (c) => {
    const body = await c.req.json<{ name: string; default_guardrail?: string }>();
    const userId: string = c.get("userId") as string;
    const id = genId("d");
    const defaultGuardrail = body.default_guardrail ?? "autonomous";

    const [row] = await db
      .insert(domains)
      .values({ id, name: body.name, userId, defaultGuardrail })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List domains (scoped to user)
  router.get("/", async (c) => {
    const userId: string = c.get("userId") as string;
    const rows = await db.select().from(domains).where(eq(domains.userId, userId));
    return c.json({ domains: rows.map(toApi) });
  });

  // PATCH /:id — Update domain
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{ name?: string; default_guardrail?: string }>();

    const existing = await db.select().from(domains)
      .where(and(eq(domains.id, id), eq(domains.userId, userId))).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const updates: Partial<typeof domains.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.default_guardrail !== undefined) updates.defaultGuardrail = body.default_guardrail;

    const [row] = await db
      .update(domains)
      .set(updates)
      .where(and(eq(domains.id, id), eq(domains.userId, userId)))
      .returning();

    return c.json(toApi(row));
  });

  // DELETE /:id — Delete domain
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const existing = await db.select().from(domains)
      .where(and(eq(domains.id, id), eq(domains.userId, userId))).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(domains).where(and(eq(domains.id, id), eq(domains.userId, userId)));
    return c.json({ deleted: true });
  });

  return router;
}
