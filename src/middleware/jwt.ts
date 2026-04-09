import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import { JWT_SECRET } from "../lib/config.js";

export function jwtMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const payload = await verify(token, JWT_SECRET, "HS256");
      c.set("userId", payload.sub as string);
      await next();
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  };
}
