import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import type { db as DbType } from "../db/connection.js";
import { apiKeys, agents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { JWT_SECRET } from "../lib/config.js";

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

    // First: try to match as API key
    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, token))
      .limit(1);

    if (row) {
      // Update agent's lastSeen if this key is tied to an agent
      if (row.agentId) {
        await db
          .update(agents)
          .set({ lastSeen: new Date() })
          .where(eq(agents.id, row.agentId));
      }

      const userId = row.userId ?? row.id;
      if (!row.userId) {
        console.warn(`API key ${row.id} has no userId — using key ID as fallback. This key should be regenerated.`);
      }

      c.set("apiKey", row);
      c.set("userId", userId);
      await next();
      return;
    }

    // Second: try to verify as JWT token
    try {
      const payload = await verify(token, JWT_SECRET, "HS256");
      c.set("userId", payload.sub as string);
      await next();
      return;
    } catch {
      // JWT verification failed — fall through to unauthorized
    }

    return c.json({ error: "Unauthorized" }, 401);
  };
}
