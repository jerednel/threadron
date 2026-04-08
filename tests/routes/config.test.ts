import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { configRoutes } from "../../src/routes/config.js";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.client.end();
});

function buildApp() {
  const app = new Hono().basePath("/v1");
  app.route("/config", configRoutes(ctx.db));
  return app;
}

describe("POST /v1/config", () => {
  it("sets a config entry", async () => {
    const app = buildApp();

    const res = await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "max_retries", value: 3 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toBe("max_retries");
    expect(body.value).toBe(3);
    expect(body.updated_at).toBeDefined();
  });

  it("upserts an existing config entry", async () => {
    const app = buildApp();

    await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "feature_flag", value: false }),
    });

    const res = await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "feature_flag", value: true }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.value).toBe(true);
  });

  it("stores complex JSON values", async () => {
    const app = buildApp();

    const complexValue = { threshold: 0.9, tags: ["a", "b"], nested: { x: 1 } };
    const res = await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "complex_config", value: complexValue }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.value).toEqual(complexValue);
  });
});

describe("GET /v1/config", () => {
  it("returns all config entries", async () => {
    const app = buildApp();

    await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "key1", value: "val1" }),
    });
    await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "key2", value: "val2" }),
    });

    const res = await app.request("/v1/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toHaveLength(2);
  });
});

describe("GET /v1/config/:key", () => {
  it("returns a specific config entry", async () => {
    const app = buildApp();

    await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "app.mode", value: "production" }),
    });

    const res = await app.request("/v1/config/app.mode");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("app.mode");
    expect(body.value).toBe("production");
  });

  it("returns 404 for missing key", async () => {
    const app = buildApp();
    const res = await app.request("/v1/config/nonexistent_key");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/config/:key", () => {
  it("updates an existing config value", async () => {
    const app = buildApp();

    await app.request("/v1/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "timeout_ms", value: 5000 }),
    });

    const res = await app.request("/v1/config/timeout_ms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 10000 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("timeout_ms");
    expect(body.value).toBe(10000);
  });

  it("returns 404 for missing key", async () => {
    const app = buildApp();
    const res = await app.request("/v1/config/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x" }),
    });
    expect(res.status).toBe(404);
  });
});
