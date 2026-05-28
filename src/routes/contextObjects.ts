import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { contextObjects, domains, threads } from "../db/schema.js";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { genId } from "../lib/id.js";

type DrizzleDb = typeof DbType;

const VALID_TYPES = new Set([
  "note",
  "decision",
  "resource",
  "question",
  "person",
  "org",
  "incident",
  "routine",
  "memory",
]);

function normalizeType(type?: string) {
  const value = (type || "note").trim().toLowerCase();
  return VALID_TYPES.has(value) ? value : "note";
}

function toApi(row: typeof contextObjects.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    domain_id: row.domainId,
    thread_id: row.threadId,
    source: row.source,
    created_by: row.createdBy,
    metadata: row.metadata,
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

async function verifyThread(db: DrizzleDb, threadId: string, userId: string) {
  const [row] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
    .limit(1);
  return !!row;
}

export function contextObjectRoutes(db: DrizzleDb) {
  const router = new Hono();

  router.get("/", async (c) => {
    const userId = c.get("userId") as string;
    const type = c.req.query("type");
    const status = c.req.query("status");
    const domainId = c.req.query("domain_id");
    const threadId = c.req.query("thread_id");
    const search = c.req.query("search");

    const filters = [eq(contextObjects.userId, userId)];
    if (type) filters.push(eq(contextObjects.type, type));
    if (status) filters.push(eq(contextObjects.status, status));
    if (domainId) filters.push(eq(contextObjects.domainId, domainId));
    if (threadId) filters.push(eq(contextObjects.threadId, threadId));
    if (search) {
      const escaped = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
      filters.push(or(ilike(contextObjects.title, escaped), ilike(contextObjects.body, escaped))!);
    }

    const rows = await db
      .select()
      .from(contextObjects)
      .where(and(...filters))
      .orderBy(desc(contextObjects.updatedAt), desc(contextObjects.createdAt));

    return c.json({ objects: rows.map(toApi) });
  });

  router.post("/", async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{
      type?: string;
      title: string;
      body: string;
      status?: string;
      domain_id?: string | null;
      thread_id?: string | null;
      source?: string;
      created_by?: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.title?.trim()) return c.json({ error: "title is required" }, 400);
    if (!body.body?.trim()) return c.json({ error: "body is required" }, 400);
    if (body.domain_id && !(await verifyDomain(db, body.domain_id, userId))) {
      return c.json({ error: "Domain not found" }, 404);
    }
    if (body.thread_id && !(await verifyThread(db, body.thread_id, userId))) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const [row] = await db
      .insert(contextObjects)
      .values({
        id: genId("ctxobj"),
        userId,
        type: normalizeType(body.type),
        title: body.title.trim(),
        body: body.body.trim(),
        status: body.status || "active",
        domainId: body.domain_id || null,
        threadId: body.thread_id || null,
        source: body.source || "dashboard",
        createdBy: body.created_by || userId,
        metadata: body.metadata || {},
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  router.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;
    const body = await c.req.json<{
      type?: string;
      title?: string;
      body?: string;
      status?: string;
      domain_id?: string | null;
      thread_id?: string | null;
      metadata?: Record<string, unknown>;
    }>();

    const [existing] = await db
      .select()
      .from(contextObjects)
      .where(and(eq(contextObjects.id, id), eq(contextObjects.userId, userId)))
      .limit(1);
    if (!existing) return c.json({ error: "Not found" }, 404);

    if (body.domain_id && !(await verifyDomain(db, body.domain_id, userId))) {
      return c.json({ error: "Domain not found" }, 404);
    }
    if (body.thread_id && !(await verifyThread(db, body.thread_id, userId))) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const [row] = await db
      .update(contextObjects)
      .set({
        type: body.type === undefined ? undefined : normalizeType(body.type),
        title: body.title,
        body: body.body,
        status: body.status,
        domainId: body.domain_id,
        threadId: body.thread_id,
        metadata: body.metadata,
        updatedAt: new Date(),
      })
      .where(and(eq(contextObjects.id, id), eq(contextObjects.userId, userId)))
      .returning();

    return c.json(toApi(row));
  });

  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId") as string;
    const [existing] = await db
      .select({ id: contextObjects.id })
      .from(contextObjects)
      .where(and(eq(contextObjects.id, id), eq(contextObjects.userId, userId)))
      .limit(1);
    if (!existing) return c.json({ error: "Not found" }, 404);
    await db.delete(contextObjects).where(eq(contextObjects.id, id));
    return c.json({ deleted: true });
  });

  return router;
}
