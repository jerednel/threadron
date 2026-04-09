import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext, TEST_USER_ID } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { taskRoutes } from "../../src/routes/tasks.js";
import { contextRoutes } from "../../src/routes/context.js";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.client.end();
});

function buildApp() {
  const app = new Hono().basePath("/v1");
  app.use("/*", async (c, next) => {
    c.set("userId", TEST_USER_ID);
    await next();
  });
  app.route("/domains", domainRoutes(ctx.db));
  app.route("/tasks", taskRoutes(ctx.db));
  app.route("/tasks", contextRoutes(ctx.db));
  return app;
}

async function createDomain(app: Hono, name = "Test Domain") {
  const res = await app.request("/v1/domains", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

async function createTask(app: Hono, domainId: string, title = "Test Task") {
  const res = await app.request("/v1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, domain_id: domainId, created_by: "test-agent" }),
  });
  return res.json();
}

describe("POST /v1/tasks/:id/claim", () => {
  it("claims a task", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code", duration_minutes: 30 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed_by).toBe("claude-code");
    expect(body.claim_expires_at).toBeTruthy();
  });

  it("rejects claim if already claimed by someone else", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    // First claim
    await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "agent-a", duration_minutes: 60 }),
    });

    // Second agent tries to claim
    const res = await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "agent-b", duration_minutes: 30 }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Already claimed");
    expect(body.claimed_by).toEqual(["agent-a"]);
  });

  it("allows same agent to reclaim", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    // Claim by agent-a
    await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "agent-a", duration_minutes: 30 }),
    });

    // Reclaim by same agent (extend)
    const res = await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "agent-a", duration_minutes: 60 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed_by).toBe("agent-a");
  });

  it("allows claim override when previous claim is expired", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    // Claim with already-expired time by setting via PATCH
    const pastTime = new Date(Date.now() - 10000).toISOString();
    await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimed_by: "agent-a", claim_expires_at: pastTime }),
    });

    // New agent should be able to claim since previous claim expired
    const res = await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "agent-b", duration_minutes: 30 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed_by).toBe("agent-b");
  });

  it("auto-generates claim context event", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code", duration_minutes: 30 }),
    });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    const body = await res.json();
    const event = body.context.find((e: any) => e.type === "claim");
    expect(event).toBeDefined();
    expect(event.body).toContain("claude-code");
    expect(event.author).toBe("claude-code");
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();

    const res = await app.request("/v1/tasks/t_nonexistent/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "agent" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /v1/tasks/:id/release", () => {
  it("releases a claim", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    // Claim first
    await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code", duration_minutes: 30 }),
    });

    // Release
    const res = await app.request(`/v1/tasks/${task.id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed_by).toBeNull();
    expect(body.claim_expires_at).toBeNull();
  });

  it("auto-generates release context event", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await app.request(`/v1/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code", duration_minutes: 30 }),
    });

    await app.request(`/v1/tasks/${task.id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    const body = await res.json();
    const event = body.context.find((e: any) => e.type === "release");
    expect(event).toBeDefined();
    expect(event.body).toContain("claude-code");
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();

    const res = await app.request("/v1/tasks/t_nonexistent/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
  });
});
