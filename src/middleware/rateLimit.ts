import { createMiddleware } from "hono/factory";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(windowMs = 60000, max = 200) {
  return createMiddleware(async (c, next) => {
    const key = c.req.header("Authorization") || c.req.header("x-forwarded-for") || "anonymous";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: "Too many requests" }, 429);
    } else {
      entry.count++;
    }

    await next();
  });
}
