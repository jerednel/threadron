import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { projects, domains } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq, and } from "drizzle-orm";

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

async function verifyDomainOwnership(db: DrizzleDb, domainId: string, userId: string): Promise<boolean> {
  const [domain] = await db.select().from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.userId, userId))).limit(1);
  return !!domain;
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
    const userId: string = c.get("userId") as string;

    const owned = await verifyDomainOwnership(db, body.domain_id, userId);
    if (!owned) {
      return c.json({ error: "Domain not found" }, 404);
    }

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

  // GET / — List projects (scoped to user's domains, optional ?domain_id= filter)
  router.get("/", async (c) => {
    const userId: string = c.get("userId") as string;
    const domainId = c.req.query("domain_id");

    const conditions = [eq(domains.userId, userId)];
    if (domainId) conditions.push(eq(projects.domainId, domainId));

    const rows = await db
      .select({ project: projects })
      .from(projects)
      .innerJoin(domains, and(eq(projects.domainId, domains.id), eq(domains.userId, userId)))
      .where(domainId ? eq(projects.domainId, domainId) : undefined);

    return c.json({ projects: rows.map((r) => toApi(r.project)) });
  });

  // GET /:id — Get single project
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const rows = await db
      .select({ project: projects })
      .from(projects)
      .innerJoin(domains, and(eq(projects.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(projects.id, id))
      .limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0].project));
  });

  // PATCH /:id — Update project
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{
      name?: string;
      description?: string;
    }>();

    const existing = await db
      .select({ project: projects })
      .from(projects)
      .innerJoin(domains, and(eq(projects.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(projects.id, id))
      .limit(1);

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
    const userId: string = c.get("userId") as string;

    const existing = await db
      .select({ project: projects })
      .from(projects)
      .innerJoin(domains, and(eq(projects.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(projects.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(projects).where(eq(projects.id, id));
    return c.json({ deleted: true });
  });

  return router;
}
