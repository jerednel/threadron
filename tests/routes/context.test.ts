import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
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

describe("POST /v1/tasks/:id/context", () => {
  it("appends a context entry to a task", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "note",
        body: "Started working on this task",
        author: "claude-code",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^ctx_/);
    expect(body.task_id).toBe(task.id);
    expect(body.type).toBe("note");
    expect(body.body).toBe("Started working on this task");
    expect(body.author).toBe("claude-code");
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();

    const res = await app.request("/v1/tasks/t_nonexistent/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", body: "test", author: "agent" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /v1/tasks/:id/context", () => {
  it("returns context entries in chronological order", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await app.request(`/v1/tasks/${task.id}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", body: "First entry", author: "agent-1" }),
    });
    await app.request(`/v1/tasks/${task.id}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "status_change", body: "Second entry", author: "agent-2" }),
    });
    await app.request(`/v1/tasks/${task.id}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "comment", body: "Third entry", author: "agent-3" }),
    });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.context).toHaveLength(3);
    expect(body.context[0].body).toBe("First entry");
    expect(body.context[1].body).toBe("Second entry");
    expect(body.context[2].body).toBe("Third entry");
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();
    const res = await app.request("/v1/tasks/t_nonexistent/context");
    expect(res.status).toBe(404);
  });

  it("returns empty context for task with no entries", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.context).toHaveLength(0);
  });
});
