import { Hono } from "hono";
import type { db as DbType } from "../db/connection.js";
import { config } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { eq, and } from "drizzle-orm";
import { validateToken, sendMessage } from "../lib/telegram.js";

type DrizzleDb = typeof DbType;

function toApi(row: typeof config.$inferSelect) {
  return {
    key: row.key,
    value: row.value,
    updated_at: row.updatedAt,
  };
}

export function configRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST / — Set/upsert config entry
  router.post("/", async (c) => {
    const body = await c.req.json<{ key: string; value: unknown }>();
    const userId: string = c.get("userId") as string;

    const [row] = await db
      .insert(config)
      .values({
        id: genId("cfg"),
        key: body.key,
        userId,
        value: body.value,
      })
      .onConflictDoUpdate({
        target: [config.userId, config.key],
        set: {
          value: body.value,
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json(toApi(row), 201);
  });

  // GET / — List all config entries (scoped to user)
  router.get("/", async (c) => {
    const userId: string = c.get("userId") as string;
    const rows = await db.select().from(config).where(eq(config.userId, userId));
    return c.json({ config: rows.map(toApi) });
  });

  // GET /:key — Get single config entry
  router.get("/:key", async (c) => {
    const key = c.req.param("key");
    const userId: string = c.get("userId") as string;
    const rows = await db.select().from(config)
      .where(and(eq(config.userId, userId), eq(config.key, key))).limit(1);

    if (rows.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(toApi(rows[0]));
  });

  // PATCH /:key — Update config entry
  router.patch("/:key", async (c) => {
    const key = c.req.param("key");
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{ value: unknown }>();

    const existing = await db.select().from(config)
      .where(and(eq(config.userId, userId), eq(config.key, key))).limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const [row] = await db
      .update(config)
      .set({ value: body.value, updatedAt: new Date() })
      .where(and(eq(config.userId, userId), eq(config.key, key)))
      .returning();

    return c.json(toApi(row));
  });

  // GET /telegram — get telegram config (token masked)
  router.get("/telegram", async (c) => {
    const userId: string = c.get("userId") as string;

    const [tokenRow] = await db.select().from(config)
      .where(and(eq(config.userId, userId), eq(config.key, "telegram_bot_token"))).limit(1);
    const [chatIdRow] = await db.select().from(config)
      .where(and(eq(config.userId, userId), eq(config.key, "telegram_chat_id"))).limit(1);

    const token = tokenRow?.value as string | undefined;
    const chatId = chatIdRow?.value as string | undefined;

    return c.json({
      connected: !!(token && chatId),
      chat_id: chatId || null,
      token_preview: token ? token.substring(0, 10) + "..." : null,
    });
  });

  // PUT /telegram — save and validate telegram config
  router.put("/telegram", async (c) => {
    const userId: string = c.get("userId") as string;
    const body = await c.req.json<{ bot_token: string; chat_id: string }>();

    if (!body.bot_token || !body.chat_id) {
      return c.json({ error: "bot_token and chat_id are required" }, 400);
    }

    // Validate the token
    const { ok, botName, error } = await validateToken(body.bot_token);
    if (!ok) {
      return c.json({ error: error || "Invalid bot token" }, 400);
    }

    // Test sending a message
    const testResult = await sendMessage(
      body.bot_token,
      body.chat_id,
      "✅ Threadron connected successfully. Task dispatches will appear here."
    );
    if (!testResult.ok) {
      return c.json({ error: `Could not send to your chat. Verify your chat ID. (${testResult.description})` }, 400);
    }

    // Save token and chat ID (upsert)
    for (const [key, value] of [["telegram_bot_token", body.bot_token], ["telegram_chat_id", body.chat_id]]) {
      const [existing] = await db.select().from(config)
        .where(and(eq(config.userId, userId), eq(config.key, key))).limit(1);
      if (existing) {
        await db.update(config).set({ value, updatedAt: new Date() })
          .where(eq(config.id, existing.id));
      } else {
        await db.insert(config).values({ id: genId("cfg"), key, userId, value });
      }
    }

    return c.json({ connected: true, bot_name: botName });
  });

  // DELETE /telegram — disconnect telegram
  router.delete("/telegram", async (c) => {
    const userId: string = c.get("userId") as string;

    await db.delete(config).where(and(eq(config.userId, userId), eq(config.key, "telegram_bot_token")));
    await db.delete(config).where(and(eq(config.userId, userId), eq(config.key, "telegram_chat_id")));

    return c.json({ disconnected: true });
  });

  return router;
}
