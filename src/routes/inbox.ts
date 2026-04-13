import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import type { db as DbType } from "../db/connection.js";
import { inboxItems, domains, tasks } from "../db/schema.js";
import { genId } from "../lib/id.js";

type DrizzleDb = typeof DbType;

function toApi(row: typeof inboxItems.$inferSelect) {
  return {
    id: row.id,
    raw_text: row.rawText,
    source: row.source,
    status: row.status,
    domain_id: row.domainId,
    parsed: row.parsedTitle
      ? {
          title: row.parsedTitle,
          next_action: row.parsedNextAction,
          project: row.parsedProject,
          owner: row.parsedOwner,
          blockers: row.parsedBlockers,
          confidence: row.parsedConfidence ? parseFloat(row.parsedConfidence) : null,
        }
      : null,
    promoted_task_id: row.promotedTaskId,
    error: row.error,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function inboxRoutes(db: DrizzleDb) {
  const router = new Hono();

  // List inbox items (user-scoped — items created by the user, optionally filtered by status)
  router.get("/", async (c) => {
    const userId = c.get("userId") as string;
    const status = c.req.query("status");

    const filters: any[] = [eq(inboxItems.createdBy, userId)];
    if (status) filters.push(eq(inboxItems.status, status));

    const rows = await db
      .select()
      .from(inboxItems)
      .where(and(...filters))
      .orderBy(desc(inboxItems.createdAt));

    return c.json({ items: rows.map(toApi) });
  });

  // Get single inbox item
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;

    const [row] = await db
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.createdBy, userId)))
      .limit(1);

    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(toApi(row));
  });

  // Create inbox item (capture)
  router.post("/", async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{
      raw_text: string;
      source?: string;
      domain_id?: string;
    }>();

    if (!body.raw_text || !body.raw_text.trim()) {
      return c.json({ error: "raw_text is required" }, 400);
    }

    // If domain_id provided, verify ownership
    if (body.domain_id) {
      const [domain] = await db
        .select()
        .from(domains)
        .where(and(eq(domains.id, body.domain_id), eq(domains.userId, userId)))
        .limit(1);
      if (!domain) return c.json({ error: "Domain not found" }, 404);
    }

    const id = genId("inbox");
    const [row] = await db
      .insert(inboxItems)
      .values({
        id,
        rawText: body.raw_text.trim(),
        source: body.source || "user",
        status: "unprocessed",
        domainId: body.domain_id || null,
        createdBy: userId,
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // Update inbox item (edit parsed fields, change status)
  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;
    const body = await c.req.json<{
      status?: string;
      raw_text?: string;
      domain_id?: string;
      parsed_title?: string;
      parsed_next_action?: string;
      parsed_project?: string;
      parsed_owner?: string;
      parsed_blockers?: string[];
      parsed_confidence?: string;
      error?: string;
    }>();

    const [existing] = await db
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.createdBy, userId)))
      .limit(1);

    if (!existing) return c.json({ error: "Not found" }, 404);

    const updates: Partial<typeof inboxItems.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.raw_text !== undefined) updates.rawText = body.raw_text;
    if (body.domain_id !== undefined) updates.domainId = body.domain_id;
    if (body.parsed_title !== undefined) updates.parsedTitle = body.parsed_title;
    if (body.parsed_next_action !== undefined) updates.parsedNextAction = body.parsed_next_action;
    if (body.parsed_project !== undefined) updates.parsedProject = body.parsed_project;
    if (body.parsed_owner !== undefined) updates.parsedOwner = body.parsed_owner;
    if (body.parsed_blockers !== undefined) updates.parsedBlockers = body.parsed_blockers;
    if (body.parsed_confidence !== undefined) updates.parsedConfidence = body.parsed_confidence;
    if (body.error !== undefined) updates.error = body.error;

    const [row] = await db
      .update(inboxItems)
      .set(updates)
      .where(eq(inboxItems.id, id))
      .returning();

    return c.json(toApi(row));
  });

  // Promote inbox item → create task
  router.post("/:id/promote", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;
    const body = await c.req.json<{
      title?: string;
      next_action?: string;
      domain_id?: string;
      project_id?: string;
      owner?: string;
      blockers?: string[];
    }>();

    const [item] = await db
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.createdBy, userId)))
      .limit(1);

    if (!item) return c.json({ error: "Not found" }, 404);
    if (item.status === "promoted") return c.json({ error: "Already promoted" }, 409);

    // Use provided overrides or fall back to parsed values
    const title = body.title || item.parsedTitle || item.rawText;
    const nextAction = body.next_action || item.parsedNextAction || null;
    const domainId = body.domain_id || item.domainId;
    const assignee = body.owner || item.parsedOwner || null;
    const blockers = body.blockers || item.parsedBlockers || [];

    if (!domainId) {
      return c.json({ error: "domain_id is required for promotion" }, 400);
    }

    // Verify domain ownership
    const [domain] = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
      .limit(1);
    if (!domain) return c.json({ error: "Domain not found" }, 404);

    // Create the task
    const taskId = genId("t");
    const [task] = await db
      .insert(tasks)
      .values({
        id: taskId,
        title,
        status: "pending",
        domainId,
        projectId: body.project_id || null,
        assignee,
        createdBy: userId,
        priority: "medium",
        nextAction: nextAction,
        blockers,
      })
      .returning();

    // Mark inbox item as promoted
    await db
      .update(inboxItems)
      .set({
        status: "promoted",
        promotedTaskId: taskId,
        updatedAt: new Date(),
      })
      .where(eq(inboxItems.id, id));

    return c.json({
      inbox_item: toApi({ ...item, status: "promoted", promotedTaskId: taskId, updatedAt: new Date() }),
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        domain_id: task.domainId,
        next_action: task.nextAction,
        assignee: task.assignee,
        blockers: task.blockers,
        created_at: task.createdAt,
      },
    });
  });

  // Delete inbox item
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;

    const [existing] = await db
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.createdBy, userId)))
      .limit(1);

    if (!existing) return c.json({ error: "Not found" }, 404);

    await db.delete(inboxItems).where(eq(inboxItems.id, id));
    return c.json({ deleted: true });
  });

  return router;
}
