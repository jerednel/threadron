import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { tasks, contextEntries } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq, and, ilike, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

type DrizzleDb = typeof DbType;

function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

function toApi(row: typeof tasks.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    domain_id: row.domainId,
    project_id: row.projectId,
    assignee: row.assignee,
    created_by: row.createdBy,
    priority: row.priority,
    guardrail: row.guardrail,
    dependencies: row.dependencies,
    due_date: row.dueDate,
    tags: row.tags,
    metadata: row.metadata,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function taskRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Create task
  router.post("/", async (c) => {
    const body = await c.req.json<{
      title: string;
      domain_id: string;
      created_by: string;
      project_id?: string;
      assignee?: string;
      priority?: string;
      guardrail?: string;
      dependencies?: string[];
      due_date?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }>();

    const id = genId("t");

    const [row] = await db
      .insert(tasks)
      .values({
        id,
        title: body.title,
        domainId: body.domain_id,
        createdBy: body.created_by,
        projectId: body.project_id ?? null,
        assignee: body.assignee ?? null,
        priority: body.priority ?? "medium",
        guardrail: body.guardrail ?? null,
        dependencies: body.dependencies ?? null,
        dueDate: body.due_date ? new Date(body.due_date) : null,
        tags: body.tags ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List tasks with optional filters
  router.get("/", async (c) => {
    const filters: SQL[] = [];

    const assignee = c.req.query("assignee");
    const status = c.req.query("status");
    const domainId = c.req.query("domain_id");
    const projectId = c.req.query("project_id");
    const guardrail = c.req.query("guardrail");
    const search = c.req.query("search");

    if (assignee) filters.push(eq(tasks.assignee, assignee));
    if (status) filters.push(eq(tasks.status, status));
    if (domainId) filters.push(eq(tasks.domainId, domainId));
    if (projectId) filters.push(eq(tasks.projectId, projectId));
    if (guardrail) filters.push(eq(tasks.guardrail, guardrail));
    if (search) filters.push(ilike(tasks.title, `%${escapeIlike(search)}%`));

    const rows =
      filters.length > 0
        ? await db.select().from(tasks).where(and(...filters))
        : await db.select().from(tasks);

    return c.json({ tasks: rows.map(toApi) });
  });

  // GET /:id — Get single task with full context log
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const context = await db
      .select()
      .from(contextEntries)
      .where(eq(contextEntries.taskId, id))
      .orderBy(asc(contextEntries.createdAt));

    const ctxToApi = (row: typeof contextEntries.$inferSelect) => ({
      id: row.id,
      task_id: row.taskId,
      type: row.type,
      body: row.body,
      author: row.author,
      created_at: row.createdAt,
    });

    return c.json({ ...toApi(rows[0]), context: context.map(ctxToApi) });
  });

  // PATCH /:id — Update task
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{
      title?: string;
      status?: string;
      project_id?: string;
      assignee?: string;
      priority?: string;
      guardrail?: string;
      dependencies?: string[];
      due_date?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }>();

    const existing = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const updates: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.status !== undefined) updates.status = body.status;
    if (body.project_id !== undefined) updates.projectId = body.project_id;
    if (body.assignee !== undefined) updates.assignee = body.assignee;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.guardrail !== undefined) updates.guardrail = body.guardrail;
    if (body.dependencies !== undefined) updates.dependencies = body.dependencies;
    if (body.due_date !== undefined) updates.dueDate = new Date(body.due_date);
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const [row] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();

    return c.json(toApi(row));
  });

  // DELETE /:id — Delete task
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");

    const existing = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(tasks).where(eq(tasks.id, id));
    return c.json({ deleted: true });
  });

  return router;
}
