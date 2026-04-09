import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { artifacts, tasks } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { recordEvent } from "../lib/events.js";
import { eq, asc } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function toApi(row: typeof artifacts.$inferSelect) {
  return {
    id: row.id,
    task_id: row.taskId,
    type: row.type,
    uri: row.uri,
    body: row.body,
    title: row.title,
    created_by: row.createdBy,
    metadata: row.metadata,
    created_at: row.createdAt,
  };
}

export function artifactRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST /tasks/:id/artifacts — Create artifact
  router.post("/:id/artifacts", async (c) => {
    const taskId = c.req.param("id");

    const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (taskRows.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const body = await c.req.json<{
      type: string;
      uri?: string;
      body?: string;
      title?: string;
      created_by: string;
      metadata?: Record<string, unknown>;
    }>();

    const id = genId("art");

    const [row] = await db
      .insert(artifacts)
      .values({
        id,
        taskId,
        type: body.type,
        uri: body.uri ?? null,
        body: body.body ?? null,
        title: body.title ?? null,
        createdBy: body.created_by,
        metadata: body.metadata ?? {},
      })
      .returning();

    await recordEvent(db, taskId, "artifact_created",
      `Artifact created: ${body.title || body.type} (${id})`,
      body.created_by, "agent");

    return c.json(toApi(row), 201);
  });

  // GET /tasks/:id/artifacts — List artifacts for a task
  router.get("/:id/artifacts", async (c) => {
    const taskId = c.req.param("id");

    const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (taskRows.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.taskId, taskId))
      .orderBy(asc(artifacts.createdAt));

    return c.json({ artifacts: rows.map(toApi) });
  });

  return router;
}

// Standalone artifact lookup (mounted separately)
export function artifactLookupRoutes(db: DrizzleDb) {
  const router = new Hono();

  // GET /artifacts/:id — Get single artifact
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0]));
  });

  return router;
}
