import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { tasks, contextEntries, domains } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { recordEvent } from "../lib/events.js";
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
    goal: row.goal,
    current_state: row.currentState,
    next_action: row.nextAction,
    blockers: row.blockers,
    outcome_definition: row.outcomeDefinition,
    confidence: row.confidence,
    claimed_by: row.claimedBy,
    claim_expires_at: row.claimExpiresAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

async function verifyDomainOwnership(db: DrizzleDb, domainId: string, userId: string): Promise<boolean> {
  const [domain] = await db.select().from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.userId, userId))).limit(1);
  return !!domain;
}

async function getTaskDomainId(db: DrizzleDb, taskId: string): Promise<string | null> {
  const [task] = await db.select({ domainId: tasks.domainId }).from(tasks)
    .where(eq(tasks.id, taskId)).limit(1);
  return task?.domainId ?? null;
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
      goal?: string;
      current_state?: string;
      next_action?: string;
      blockers?: string[];
      outcome_definition?: string;
      confidence?: string;
      claimed_by?: string;
      claim_expires_at?: string;
    }>();

    const userId: string = c.get("userId") as string;

    // Verify domain belongs to user
    const owned = await verifyDomainOwnership(db, body.domain_id, userId);
    if (!owned) {
      return c.json({ error: "Domain not found" }, 404);
    }

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
        goal: body.goal ?? null,
        currentState: body.current_state ?? null,
        nextAction: body.next_action ?? null,
        blockers: body.blockers ?? [],
        outcomeDefinition: body.outcome_definition ?? null,
        confidence: body.confidence ?? null,
        claimedBy: body.claimed_by ?? null,
        claimExpiresAt: body.claim_expires_at ? new Date(body.claim_expires_at) : null,
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List tasks with optional filters (scoped to user via domain join)
  router.get("/", async (c) => {
    const userId: string = c.get("userId") as string;
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

    // Always scope to user's domains
    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(filters.length > 0 ? and(...filters) : undefined);

    return c.json({ tasks: rows.map((r) => toApi(r.task)) });
  });

  // GET /:id — Get single task with full context log and artifacts
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.id, id))
      .limit(1);

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
      actor_type: row.actorType,
      created_at: row.createdAt,
    });

    // Import artifacts inline to avoid circular deps
    const { artifacts } = await import("../db/schema.js");
    const artifactRows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.taskId, id))
      .orderBy(asc(artifacts.createdAt));

    const artifactToApi = (row: typeof artifacts.$inferSelect) => ({
      id: row.id,
      task_id: row.taskId,
      type: row.type,
      uri: row.uri,
      body: row.body,
      title: row.title,
      created_by: row.createdBy,
      metadata: row.metadata,
      created_at: row.createdAt,
    });

    return c.json({
      ...toApi(rows[0].task),
      context: context.map(ctxToApi),
      artifacts: artifactRows.map(artifactToApi),
    });
  });

  // PATCH /:id — Update task
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
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
      goal?: string;
      current_state?: string;
      next_action?: string;
      blockers?: string[];
      outcome_definition?: string;
      confidence?: string;
      claimed_by?: string;
      claim_expires_at?: string;
      // Actor attribution for auto-events
      _actor?: string;
      _actor_type?: string;
    }>();

    const existingRows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const oldRow = existingRows[0].task;

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
    if (body.goal !== undefined) updates.goal = body.goal;
    if (body.current_state !== undefined) updates.currentState = body.current_state;
    if (body.next_action !== undefined) updates.nextAction = body.next_action;
    if (body.blockers !== undefined) updates.blockers = body.blockers;
    if (body.outcome_definition !== undefined) updates.outcomeDefinition = body.outcome_definition;
    if (body.confidence !== undefined) updates.confidence = body.confidence;
    if (body.claimed_by !== undefined) updates.claimedBy = body.claimed_by;
    if (body.claim_expires_at !== undefined) updates.claimExpiresAt = new Date(body.claim_expires_at);

    const [row] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();

    // Auto-generate system events for state transitions
    const actor = body._actor || "system";
    const actorType = body._actor_type || "system";

    if (body.status !== undefined && body.status !== oldRow.status) {
      await recordEvent(db, id, "state_transition",
        `Status changed from ${oldRow.status} to ${body.status}`,
        actor, actorType);
    }
    if (body.assignee !== undefined && body.assignee !== oldRow.assignee) {
      await recordEvent(db, id, "handoff",
        `Assigned from ${oldRow.assignee || 'unassigned'} to ${body.assignee}`,
        actor, actorType);
    }
    if (body.claimed_by !== undefined && body.claimed_by !== oldRow.claimedBy) {
      await recordEvent(db, id, "handoff",
        `Claimed by ${body.claimed_by}`,
        actor, actorType);
    }
    if (body.guardrail !== undefined && body.guardrail !== oldRow.guardrail) {
      await recordEvent(db, id, "state_transition",
        `Guardrail changed from ${oldRow.guardrail || 'none'} to ${body.guardrail}`,
        actor, actorType);
    }
    if (body.current_state !== undefined && body.current_state !== oldRow.currentState) {
      await recordEvent(db, id, "state_transition",
        `State updated: ${body.current_state}`,
        actor, actorType);
    }
    if (body.next_action !== undefined && body.next_action !== oldRow.nextAction) {
      await recordEvent(db, id, "state_transition",
        `Next action: ${body.next_action}`,
        actor, actorType);
    }

    return c.json(toApi(row));
  });

  // DELETE /:id — Delete task
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;

    const existingRows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    await db.delete(tasks).where(eq(tasks.id, id));
    return c.json({ deleted: true });
  });

  // POST /:id/claim — Claim a work item
  router.post("/:id/claim", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{
      agent_id: string;
      duration_minutes?: number;
    }>();

    const existingRows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const row = existingRows[0].task;
    const now = new Date();

    // Check if already claimed by someone else (and not expired)
    if (row.claimedBy && row.claimedBy !== body.agent_id) {
      const isExpired = row.claimExpiresAt && row.claimExpiresAt <= now;
      if (!isExpired) {
        return c.json({ error: "Already claimed", claimed_by: row.claimedBy, claim_expires_at: row.claimExpiresAt }, 409);
      }
    }

    const durationMinutes = body.duration_minutes ?? 30;
    const claimExpiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const [updated] = await db
      .update(tasks)
      .set({ claimedBy: body.agent_id, claimExpiresAt, updatedAt: now })
      .where(eq(tasks.id, id))
      .returning();

    await recordEvent(db, id, "claim",
      `Claimed by ${body.agent_id} for ${durationMinutes} minutes`,
      body.agent_id, "agent");

    return c.json(toApi(updated));
  });

  // POST /:id/release — Release a claim
  router.post("/:id/release", async (c) => {
    const id = c.req.param("id");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{
      agent_id?: string;
    }>().catch(() => ({}));

    const existingRows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(domains, and(eq(tasks.domainId, domains.id), eq(domains.userId, userId)))
      .where(eq(tasks.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const [updated] = await db
      .update(tasks)
      .set({ claimedBy: null, claimExpiresAt: null, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    const actor = (body as any).agent_id || "system";
    await recordEvent(db, id, "release",
      `Claim released by ${actor}`,
      actor, "agent");

    return c.json(toApi(updated));
  });

  return router;
}
