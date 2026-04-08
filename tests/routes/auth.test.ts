import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { authPublicRoutes, authProtectedRoutes } from "../../src/routes/auth.js";
import { authMiddleware } from "../../src/middleware/auth.js";
import { apiKeys } from "../../src/db/schema.js";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.client.end();
});

function buildApp() {
  const app = new Hono().basePath("/v1");
  app.route("/auth", authPublicRoutes(ctx.db));

  // Protected sub-app (includes auth key management routes)
  const protected_ = new Hono();
  protected_.use("/*", authMiddleware(ctx.db));
  protected_.route("/auth", authProtectedRoutes(ctx.db));
  app.route("/", protected_);

  // A protected test endpoint to verify auth middleware
  app.get("/protected", authMiddleware(ctx.db), (c) => {
    return c.json({ ok: true });
  });

  return app;
}

describe("POST /v1/auth/setup", () => {
  it("creates initial API key and returns tfa_sk_ prefixed key", async () => {
    const app = buildApp();
    const res = await app.request("/v1/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "my-key" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^key_/);
    expect(body.api_key).toMatch(/^tfa_sk_/);
    expect(body.name).toBe("my-key");
  });

  it("returns 409 if keys already exist", async () => {
    const app = buildApp();

    // Seed an existing key
    await ctx.db.insert(apiKeys).values({
      id: "key_existing",
      key: "tfa_sk_k_existing001",
      name: "pre-existing",
    });

    const res = await app.request("/v1/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "my-key" }),
    });

    expect(res.status).toBe(409);
  });
});

describe("Auth middleware", () => {
  it("rejects requests without API key (401)", async () => {
    const app = buildApp();
    const res = await app.request("/v1/protected");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid API key (401)", async () => {
    const app = buildApp();
    const res = await app.request("/v1/protected", {
      headers: { Authorization: "Bearer invalid_key_xyz" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts requests with valid API key (200)", async () => {
    const app = buildApp();

    // Create a valid key via setup
    const setupRes = await app.request("/v1/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test-key" }),
    });
    expect(setupRes.status).toBe(201);
    const { api_key } = await setupRes.json();

    const res = await app.request("/v1/protected", {
      headers: { Authorization: `Bearer ${api_key}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
