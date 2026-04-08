import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { projects } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function toApi(row: typeof projects.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    domain_id: row.domainId,
    description: row.description,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function projectRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Create project
  router.post("/", async (c) => {
    const body = await c.req.json<{
      name: string;
      domain_id: string;
      description?: string;
    }>();
    const id = genId("p");

    const [row] = await db
      .insert(projects)
      .values({
        id,
        name: body.name,
        domainId: body.domain_id,
        description: body.description ?? null,
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List projects (optional ?domain_id= filter)
  router.get("/", async (c) => {
    const domainId = c.req.query("domain_id");
    const rows = domainId
      ? await db.select().from(projects).where(eq(projects.domainId, domainId))
      : await db.select().from(projects);

    return c.json({ projects: rows.map(toApi) });
  });

  // GET /:id — Get single project
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0]));
  });

  // PATCH /:id — Update project
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      description?: string;
    }>();

    const existing = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const updates: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    const [row] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    return c.json(toApi(row));
  });

  // DELETE /:id — Delete project
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(projects).where(eq(projects.id, id));
    return c.json({ deleted: true });
  });

  return router;
}
