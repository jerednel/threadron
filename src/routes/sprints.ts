import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { domains, sprintItems, sprints, tasks, threads } from "../db/schema.js";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { genId } from "../lib/id.js";

type DrizzleDb = typeof DbType;

const VALID_SPRINT_STATUSES = new Set(["planned", "active", "closed"]);
const VALID_COMMITMENT_STATUSES = new Set(["planned", "committed", "stretch", "removed"]);

function normalizeSprintStatus(status?: string) {
  const value = (status || "planned").trim().toLowerCase();
  return VALID_SPRINT_STATUSES.has(value) ? value : "planned";
}

function normalizeCommitmentStatus(status?: string) {
  const value = (status || "planned").trim().toLowerCase();
  return VALID_COMMITMENT_STATUSES.has(value) ? value : "planned";
}

function parseOptionalDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function toSprintApi(row: typeof sprints.$inferSelect, itemCount?: number) {
  return {
    id: row.id,
    user_id: row.userId,
    domain_id: row.domainId,
    name: row.name,
    status: row.status,
    goal: row.goal,
    start_date: row.startDate,
    end_date: row.endDate,
    capacity_notes: row.capacityNotes,
    metadata: row.metadata,
    created_by: row.createdBy,
    item_count: itemCount,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function toSprintItemApi(row: typeof sprintItems.$inferSelect, task?: typeof tasks.$inferSelect | null, thread?: typeof threads.$inferSelect | null) {
  return {
    id: row.id,
    sprint_id: row.sprintId,
    task_id: row.taskId,
    thread_id: row.threadId,
    commitment_status: row.commitmentStatus,
    position: row.position,
    added_by: row.addedBy,
    metadata: row.metadata,
    task: task
      ? {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assignee: task.assignee,
          current_state: task.currentState,
          next_action: task.nextAction,
          blockers: task.blockers,
          thread_id: task.threadId,
          domain_id: task.domainId,
          updated_at: task.updatedAt,
        }
      : null,
    thread: thread
      ? {
          id: thread.id,
          name: thread.name,
          status: thread.status,
          current_state: thread.currentState,
          next_action: thread.nextAction,
          blockers: thread.blockers,
          updated_at: thread.updatedAt,
        }
      : null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

async function verifyDomain(db: DrizzleDb, domainId: string, userId: string) {
  const [row] = await db
    .select({ id: domains.id })
    .from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
    .limit(1);
  return !!row;
}

async function getSprint(db: DrizzleDb, sprintId: string, userId: string) {
  const [row] = await db
    .select()
    .from(sprints)
    .where(and(eq(sprints.id, sprintId), eq(sprints.userId, userId)))
    .limit(1);
  return row || null;
}

async function verifyTask(db: DrizzleDb, taskId: string, userId: string, domainId?: string | null) {
  const filters = [eq(tasks.id, taskId), eq(domains.userId, userId)];
  if (domainId) filters.push(eq(tasks.domainId, domainId));
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
    .where(and(...filters))
    .limit(1);
  return !!row;
}

async function verifyThread(db: DrizzleDb, threadId: string, userId: string) {
  const [row] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
    .limit(1);
  return !!row;
}

export function sprintRoutes(db: DrizzleDb) {
  const router = new Hono();

  router.post("/", async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{
      name: string;
      domain_id?: string | null;
      status?: string;
      goal?: string;
      start_date?: string | null;
      end_date?: string | null;
      capacity_notes?: string;
      created_by?: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.name?.trim()) return c.json({ error: "name is required" }, 400);
    if (body.domain_id && !(await verifyDomain(db, body.domain_id, userId))) {
      return c.json({ error: "Domain not found" }, 404);
    }

    const [row] = await db
      .insert(sprints)
      .values({
        id: genId("sp"),
        userId,
        domainId: body.domain_id || null,
        name: body.name.trim(),
        status: normalizeSprintStatus(body.status),
        goal: body.goal ?? null,
        startDate: parseOptionalDate(body.start_date),
        endDate: parseOptionalDate(body.end_date),
        capacityNotes: body.capacity_notes ?? null,
        metadata: body.metadata || {},
        createdBy: body.created_by || userId,
      })
      .returning();

    return c.json(toSprintApi(row, 0), 201);
  });

  router.get("/", async (c) => {
    const userId = c.get("userId") as string;
    const status = c.req.query("status");
    const domainId = c.req.query("domain_id");
    const filters = [eq(sprints.userId, userId)];
    if (status) filters.push(eq(sprints.status, status));
    if (domainId) filters.push(eq(sprints.domainId, domainId));

    const rows = await db
      .select({
        sprint: sprints,
        itemCount: sql<number>`count(${sprintItems.id})`.as("item_count"),
      })
      .from(sprints)
      .leftJoin(sprintItems, and(eq(sprintItems.sprintId, sprints.id), or(isNull(sprintItems.commitmentStatus), sql`${sprintItems.commitmentStatus} != 'removed'`)!))
      .where(and(...filters))
      .groupBy(sprints.id)
      .orderBy(desc(sprints.updatedAt), desc(sprints.createdAt));

    return c.json({ sprints: rows.map((row) => toSprintApi(row.sprint, Number(row.itemCount))) });
  });

  router.get("/:id", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const sprint = await getSprint(db, id, userId);
    if (!sprint) return c.json({ error: "Not found" }, 404);

    const itemRows = await db
      .select({ item: sprintItems, task: tasks, thread: threads })
      .from(sprintItems)
      .leftJoin(tasks, eq(sprintItems.taskId, tasks.id))
      .leftJoin(threads, eq(sprintItems.threadId, threads.id))
      .where(eq(sprintItems.sprintId, id))
      .orderBy(asc(sprintItems.position), asc(sprintItems.createdAt));

    return c.json({
      ...toSprintApi(sprint, itemRows.length),
      items: itemRows.map((row) => toSprintItemApi(row.item, row.task, row.thread)),
    });
  });

  router.patch("/:id", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const existing = await getSprint(db, id, userId);
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = await c.req.json<{
      name?: string;
      domain_id?: string | null;
      status?: string;
      goal?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      capacity_notes?: string | null;
      metadata?: Record<string, unknown>;
    }>();

    if (body.domain_id && !(await verifyDomain(db, body.domain_id, userId))) {
      return c.json({ error: "Domain not found" }, 404);
    }

    const [row] = await db
      .update(sprints)
      .set({
        name: body.name,
        domainId: body.domain_id,
        status: body.status === undefined ? undefined : normalizeSprintStatus(body.status),
        goal: body.goal,
        startDate: body.start_date === undefined ? undefined : parseOptionalDate(body.start_date),
        endDate: body.end_date === undefined ? undefined : parseOptionalDate(body.end_date),
        capacityNotes: body.capacity_notes,
        metadata: body.metadata,
        updatedAt: new Date(),
      })
      .where(and(eq(sprints.id, id), eq(sprints.userId, userId)))
      .returning();

    return c.json(toSprintApi(row));
  });

  router.post("/:id/items", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const sprint = await getSprint(db, id, userId);
    if (!sprint) return c.json({ error: "Sprint not found" }, 404);

    const body = await c.req.json<{
      task_id?: string;
      thread_id?: string;
      commitment_status?: string;
      position?: number;
      added_by?: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.task_id && !body.thread_id) return c.json({ error: "task_id or thread_id is required" }, 400);
    if (body.task_id && body.thread_id) return c.json({ error: "Add either task_id or thread_id, not both" }, 400);
    if (body.task_id && !(await verifyTask(db, body.task_id, userId, sprint.domainId))) {
      return c.json({ error: "Task not found" }, 404);
    }
    if (body.thread_id && !(await verifyThread(db, body.thread_id, userId))) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const [row] = await db
      .insert(sprintItems)
      .values({
        id: genId("spi"),
        sprintId: id,
        taskId: body.task_id || null,
        threadId: body.thread_id || null,
        commitmentStatus: normalizeCommitmentStatus(body.commitment_status),
        position: body.position ?? 0,
        addedBy: body.added_by || userId,
        metadata: body.metadata || {},
      })
      .returning();

    await db.update(sprints).set({ updatedAt: new Date() }).where(eq(sprints.id, id));
    return c.json(toSprintItemApi(row), 201);
  });

  router.patch("/:id/items/:item_id", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const itemId = c.req.param("item_id");
    if (!(await getSprint(db, id, userId))) return c.json({ error: "Sprint not found" }, 404);
    const body = await c.req.json<{ commitment_status?: string; position?: number; metadata?: Record<string, unknown> }>();

    const [row] = await db
      .update(sprintItems)
      .set({
        commitmentStatus: body.commitment_status === undefined ? undefined : normalizeCommitmentStatus(body.commitment_status),
        position: body.position,
        metadata: body.metadata,
        updatedAt: new Date(),
      })
      .where(and(eq(sprintItems.id, itemId), eq(sprintItems.sprintId, id)))
      .returning();

    if (!row) return c.json({ error: "Not found" }, 404);
    await db.update(sprints).set({ updatedAt: new Date() }).where(eq(sprints.id, id));
    return c.json(toSprintItemApi(row));
  });

  router.delete("/:id/items/:item_id", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const itemId = c.req.param("item_id");
    if (!(await getSprint(db, id, userId))) return c.json({ error: "Sprint not found" }, 404);

    const [existing] = await db
      .select({ id: sprintItems.id })
      .from(sprintItems)
      .where(and(eq(sprintItems.id, itemId), eq(sprintItems.sprintId, id)))
      .limit(1);
    if (!existing) return c.json({ error: "Not found" }, 404);

    await db.delete(sprintItems).where(eq(sprintItems.id, itemId));
    await db.update(sprints).set({ updatedAt: new Date() }).where(eq(sprints.id, id));
    return c.json({ deleted: true });
  });

  router.delete("/:id", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const sprint = await getSprint(db, id, userId);
    if (!sprint) return c.json({ error: "Not found" }, 404);
    await db.delete(sprints).where(eq(sprints.id, id));
    return c.json({ deleted: true });
  });

  return router;
}
