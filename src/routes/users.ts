import { Hono } from "hono";
import { sign } from "hono/jwt";
import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { db as DbType } from "../db/connection.js";
import { users, apiKeys, domains } from "../db/schema.js";
import { genId } from "../lib/id.js";
import { jwtMiddleware } from "../middleware/jwt.js";

type DrizzleDb = typeof DbType;

const JWT_SECRET = process.env.JWT_SECRET || "tfa-dev-secret-change-me";
const JWT_EXPIRY_DAYS = 7;

function generateApiKey(): string {
  return `tfa_sk_${genId("k")}`;
}

async function createToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: userId,
      email,
      iat: now,
      exp: now + JWT_EXPIRY_DAYS * 24 * 60 * 60,
    },
    JWT_SECRET,
    "HS256"
  );
}

export function userPublicRoutes(db: DrizzleDb) {
  const router = new Hono();

  // POST /register — Create account
  router.post("/register", async (c) => {
    const body = await c.req.json<{
      email?: string;
      password?: string;
      name?: string;
    }>();

    const { email, password, name } = body ?? {};

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Check for duplicate email
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = genId("u");

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      name: name ?? null,
    });

    // Auto-create an API key for this user
    const keyId = genId("key");
    const apiKey = generateApiKey();
    await db.insert(apiKeys).values({
      id: keyId,
      key: apiKey,
      name: `${name ?? email}'s key`,
      userId,
    });

    const token = await createToken(userId, email);

    return c.json(
      {
        user: { id: userId, email, name: name ?? null },
        token,
        api_key: apiKey,
      },
      201
    );
  });

  // POST /login — Login
  router.post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await createToken(user.id, user.email);

    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  });

  return router;
}

export function userProtectedRoutes(db: DrizzleDb) {
  const router = new Hono();

  // GET /me — Get current user info
  router.get("/me", jwtMiddleware(), async (c) => {
    const userId = c.get("userId") as string;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const userApiKeys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));

    const userDomains = await db.select().from(domains);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.createdAt,
      },
      api_keys: userApiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        key_prefix: k.key.slice(0, 16) + "...",
        created_at: k.createdAt,
      })),
      domains: userDomains.map((d) => ({
        id: d.id,
        name: d.name,
        created_at: d.createdAt,
      })),
    });
  });

  return router;
}
