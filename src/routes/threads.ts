import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { domains, tasks, threads } from "../db/schema.js";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { genId } from "../lib/id.js";
import { createThread, toThreadApi, updateThreadSnapshot } from "../lib/threads.js";

type DrizzleDb = typeof DbType;

async function verifyTaskOwnership(db: DrizzleDb, taskId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return !!row;
}

async function verifyThreadOwnership(db: DrizzleDb, threadId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
    .limit(1);
  return !!row;
}

export function threadRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Create a thread
  router.post("/", async (c) => {
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{
      name: string;
      source?: string;
      status?: string;
      parent_thread_id?: string;
      root_task_id?: string;
      current_task_id?: string;
      current_state?: string;
      next_action?: string;
      blockers?: string[];
      outcome_definition?: string;
      confidence?: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.name || !body.name.trim()) {
      return c.json({ error: "name is required" }, 400);
    }

    if (body.parent_thread_id && !(await verifyThreadOwnership(db, body.parent_thread_id, userId))) {
      return c.json({ error: "Parent thread not found" }, 404);
    }
    if (body.root_task_id && !(await verifyTaskOwnership(db, body.root_task_id, userId))) {
      return c.json({ error: "Root task not found" }, 404);
    }
    if (body.current_task_id && !(await verifyTaskOwnership(db, body.current_task_id, userId))) {
      return c.json({ error: "Current task not found" }, 404);
    }

    const row = await createThread(db, {
      id: genId("th"),
      name: body.name.trim(),
      userId,
      createdBy: userId,
      source: body.source ?? null,
      status: body.status ?? "active",
      parentThreadId: body.parent_thread_id ?? null,
      rootTaskId: body.root_task_id ?? null,
      currentTaskId: body.current_task_id ?? null,
      currentState: body.current_state ?? null,
      nextAction: body.next_action ?? null,
      blockers: body.blockers ?? [],
      outcomeDefinition: body.outcome_definition ?? null,
      confidence: body.confidence ?? null,
      metadata: body.metadata ?? {},
    });

    return c.json(toThreadApi(row), 201);
  });

  // GET / — List threads
  router.get("/", async (c) => {
    const userId: string = c.get("userId") as string;
    const status = c.req.query("status");
    const search = c.req.query("search");
    const source = c.req.query("source");

    const filters = [eq(threads.userId, userId)];
    if (status) filters.push(eq(threads.status, status));
    if (source) filters.push(eq(threads.source, source));
    if (search) filters.push(or(
      ilike(threads.name, `%${search.replace(/[%_\\]/g, "\\$&")}%`),
      ilike(threads.currentState, `%${search.replace(/[%_\\]/g, "\\$&")}%`),
      ilike(threads.nextAction, `%${search.replace(/[%_\\]/g, "\\$&")}%`)
    )!);

    const rows = await db
      .select({
        thread: threads,
        taskCount: sql<number>`count(${tasks.id})`.as("task_count"),
        openTaskCount: sql<number>`count(${tasks.id}) filter (where ${tasks.status} in ('pending', 'in_progress', 'blocked'))`.as("open_task_count"),
      })
      .from(threads)
      .leftJoin(tasks, eq(tasks.threadId, threads.id))
      .where(and(...filters))
      .groupBy(threads.id)
      .orderBy(desc(threads.updatedAt), desc(threads.createdAt));

    return c.json({
      threads: rows.map((row) => ({
        ...toThreadApi(row.thread),
        task_count: Number(row.taskCount),
        open_task_count: Number(row.openTaskCount),
      })),
    });
  });

  // GET /:id — Thread detail with tasks
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const [row] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .limit(1);

    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }

    const threadTasks = await db
      .select()
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.threadId, id))
      .orderBy(desc(tasks.updatedAt), asc(tasks.createdAt));

    return c.json({
      ...toThreadApi(row),
      tasks: threadTasks.map((r) => ({
        id: r.tasks.id,
        title: r.tasks.title,
        status: r.tasks.status,
        domain_id: r.tasks.domainId,
        project_id: r.tasks.projectId,
        assignee: r.tasks.assignee,
        created_by: r.tasks.createdBy,
        priority: r.tasks.priority,
        goal: r.tasks.goal,
        current_state: r.tasks.currentState,
        next_action: r.tasks.nextAction,
        blockers: r.tasks.blockers,
        outcome_definition: r.tasks.outcomeDefinition,
        confidence: r.tasks.confidence,
        claimed_by: r.tasks.claimedBy,
        claim_expires_at: r.tasks.claimExpiresAt,
        parent_task_id: r.tasks.parentTaskId,
        thread_id: r.tasks.threadId,
        created_at: r.tasks.createdAt,
        updated_at: r.tasks.updatedAt,
      })),
    });
  });

  // PATCH /:id — Update thread snapshot
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{
      name?: string;
      status?: string;
      source?: string | null;
      parent_thread_id?: string | null;
      current_task_id?: string | null;
      root_task_id?: string | null;
      current_state?: string | null;
      next_action?: string | null;
      blockers?: string[];
      outcome_definition?: string | null;
      confidence?: string | null;
      metadata?: Record<string, unknown>;
    }>();

    const existing = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    if (body.parent_thread_id && !(await verifyThreadOwnership(db, body.parent_thread_id, userId))) {
      return c.json({ error: "Parent thread not found" }, 404);
    }
    if (body.current_task_id && !(await verifyTaskOwnership(db, body.current_task_id, userId))) {
      return c.json({ error: "Current task not found" }, 404);
    }
    if (body.root_task_id && !(await verifyTaskOwnership(db, body.root_task_id, userId))) {
      return c.json({ error: "Root task not found" }, 404);
    }

    const [row] = await db
      .update(threads)
      .set({
        name: body.name,
        status: body.status,
        source: body.source,
        parentThreadId: body.parent_thread_id,
        currentTaskId: body.current_task_id,
        rootTaskId: body.root_task_id,
        currentState: body.current_state,
        nextAction: body.next_action,
        blockers: body.blockers,
        outcomeDefinition: body.outcome_definition,
        confidence: body.confidence,
        metadata: body.metadata,
        updatedAt: new Date(),
      })
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .returning();

    return c.json(toThreadApi(row));
  });

  // POST /:id/sync-from-task — Pull thread snapshot from a task
  router.post("/:id/sync-from-task", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{ task_id: string }>();

    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .limit(1);
    if (!thread) return c.json({ error: "Not found" }, 404);

    const [task] = await db
      .select()
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.id, body.task_id))
      .limit(1);
    if (!task) return c.json({ error: "Task not found" }, 404);

    if (task.tasks.threadId !== id) {
      return c.json({ error: "Task does not belong to this thread" }, 400);
    }

    const row = await updateThreadSnapshot(db, id, {
      currentTaskId: task.tasks.id,
      currentState: task.tasks.currentState,
      nextAction: task.tasks.nextAction,
      blockers: task.tasks.blockers,
      outcomeDefinition: task.tasks.outcomeDefinition,
      confidence: task.tasks.confidence,
    });

    return c.json(toThreadApi(row));
  });

  return router;
}

