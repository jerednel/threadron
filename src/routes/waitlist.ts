import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { waitlist } from "../db/schema.js";
import { genId } from "../lib/id.js";

type DrizzleDb = typeof DbType;

export function waitlistRoutes(db: DrizzleDb) {
  const router = new Hono();

  router.post("/", async (c) => {
    const body = await c.req.json<{ email?: string }>();
    const email = body?.email?.trim();

    if (!email || !email.includes("@")) {
      return c.json({ error: "Valid email required" }, 400);
    }

    try {
      const [row] = await db
        .insert(waitlist)
        .values({
          id: genId("wl"),
          email,
        })
        .returning();

      return c.json({ message: "You're on the list!", email: row.email }, 201);
    } catch (err: any) {
      if (err.code === "23505") {
        // unique violation — already signed up
        return c.json({ message: "You're already on the list!", email }, 200);
      }
      throw err;
    }
  });

  return router;
}
