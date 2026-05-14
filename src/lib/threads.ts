import type { db as DbType } from "../db/connection.js";
import { threads, tasks } from "../db/schema.js";
import { eq } from "drizzle-orm";

type DrizzleDb = typeof DbType;

export type ThreadRow = typeof threads.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;

export function toThreadApi(row: ThreadRow) {
  return {
    id: row.id,
    name: row.name,
    user_id: row.userId,
    status: row.status,
    source: row.source,
    parent_thread_id: row.parentThreadId,
    root_task_id: row.rootTaskId,
    current_task_id: row.currentTaskId,
    current_state: row.currentState,
    next_action: row.nextAction,
    blockers: row.blockers,
    outcome_definition: row.outcomeDefinition,
    confidence: row.confidence,
    metadata: row.metadata,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function createThread(db: DrizzleDb, input: {
  id: string;
  name: string;
  userId: string;
  createdBy: string;
  source?: string | null;
  parentThreadId?: string | null;
  rootTaskId?: string | null;
  currentTaskId?: string | null;
  status?: string;
  currentState?: string | null;
  nextAction?: string | null;
  blockers?: string[];
  outcomeDefinition?: string | null;
  confidence?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db.insert(threads).values({
    id: input.id,
    name: input.name,
    userId: input.userId,
    status: input.status ?? "active",
    source: input.source ?? null,
    parentThreadId: input.parentThreadId ?? null,
    rootTaskId: input.rootTaskId ?? null,
    currentTaskId: input.currentTaskId ?? null,
    currentState: input.currentState ?? null,
    nextAction: input.nextAction ?? null,
    blockers: input.blockers ?? [],
    outcomeDefinition: input.outcomeDefinition ?? null,
    confidence: input.confidence ?? null,
    metadata: input.metadata ?? {},
    createdBy: input.createdBy,
  }).returning();

  return row;
}

export async function updateThreadSnapshot(db: DrizzleDb, threadId: string, snapshot: {
  name?: string;
  status?: string;
  currentTaskId?: string | null;
  rootTaskId?: string | null;
  currentState?: string | null;
  nextAction?: string | null;
  blockers?: string[];
  outcomeDefinition?: string | null;
  confidence?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const updates: Partial<typeof threads.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (snapshot.name !== undefined) updates.name = snapshot.name;
  if (snapshot.status !== undefined) updates.status = snapshot.status;
  if (snapshot.currentTaskId !== undefined) updates.currentTaskId = snapshot.currentTaskId;
  if (snapshot.rootTaskId !== undefined) updates.rootTaskId = snapshot.rootTaskId;
  if (snapshot.currentState !== undefined) updates.currentState = snapshot.currentState;
  if (snapshot.nextAction !== undefined) updates.nextAction = snapshot.nextAction;
  if (snapshot.blockers !== undefined) updates.blockers = snapshot.blockers;
  if (snapshot.outcomeDefinition !== undefined) updates.outcomeDefinition = snapshot.outcomeDefinition;
  if (snapshot.confidence !== undefined) updates.confidence = snapshot.confidence;
  if (snapshot.metadata !== undefined) updates.metadata = snapshot.metadata;

  const [row] = await db
    .update(threads)
    .set(updates)
    .where(eq(threads.id, threadId))
    .returning();

  return row;
}

export async function getThreadById(db: DrizzleDb, threadId: string) {
  const [row] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1);
  return row ?? null;
}

