import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { contextEntries, tasks, domains } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq, and, asc } from "drizzle-orm";

type DrizzleDb = typeof DbType;

const VALID_TYPES = new Set([
  "observation",
  "action_taken",
  "decision",
  "blocker",
  "state_transition",
  "handoff",
  "proposal",
  "approval_requested",
  "approval_received",
  "artifact_created",
  "claim",
  "release",
  // Legacy types kept for compatibility
  "note",
  "comment",
  "status_change",
]);

function toApi(row: typeof contextEntries.$inferSelect) {
  return {
    id: row.id,
    task_id: row.taskId,
    type: row.type,
    body: row.body,
    author: row.author,
    actor_type: row.actorType,
    created_at: row.createdAt,
  };
}

async function verifyTaskOwnership(db: DrizzleDb, taskId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return !!row;
}

export function contextRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST /:id/context — Append context entry
  router.post("/:id/context", async (c) => {
    const taskId = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const owned = await verifyTaskOwnership(db, taskId, userId);
    if (!owned) {
      return c.json({ error: "Task not found" }, 404);
    }

    const body = await c.req.json<{
      type: string;
      body: string;
      author: string;
      actor_type?: string;
    }>();

    const id = genId("ctx");

    const [row] = await db
      .insert(contextEntries)
      .values({
        id,
        taskId,
        type: body.type,
        body: body.body,
        author: body.author,
        actorType: body.actor_type ?? "agent",
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET /:id/context — List context entries (chronological)
  router.get("/:id/context", async (c) => {
    const taskId = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const owned = await verifyTaskOwnership(db, taskId, userId);
    if (!owned) {
      return c.json({ error: "Task not found" }, 404);
    }

    const rows = await db
      .select()
      .from(contextEntries)
      .where(eq(contextEntries.taskId, taskId))
      .orderBy(asc(contextEntries.createdAt));

    return c.json({ context: rows.map(toApi) });
  });

  return router;
}
