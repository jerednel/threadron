import type { MiddlewareHandler } from "hono";
import type { db as DbType } from "../db/connection.js";
import { apiKeys, agents } from "../db/schema.js";
import { eq } from "drizzle-orm";

type DrizzleDb = typeof DbType;

export function authMiddleware(db: DrizzleDb): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, token))
      .limit(1);

    if (!row) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Update agent's lastSeen if this key is tied to an agent
    if (row.agentId) {
      await db
        .update(agents)
        .set({ lastSeen: new Date() })
        .where(eq(agents.id, row.agentId));
    }

    c.set("apiKey", row);
    await next();
  };
}
