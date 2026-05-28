import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext, TEST_USER_ID } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { taskRoutes } from "../../src/routes/tasks.js";
import { contextRoutes } from "../../src/routes/context.js";
import { threadRoutes } from "../../src/routes/threads.js";

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
  app.route("/threads", threadRoutes(ctx.db));
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

describe("POST /v1/tasks", () => {
  it("auto-creates a thread when none is provided", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const res = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Build feature",
        domain_id: domain.id,
        created_by: "claude-code",
        current_state: "Starting work",
      }),
    });

    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.thread_id).toMatch(/^th_/);

    const threadRes = await app.request(`/v1/threads/${task.thread_id}`);
    expect(threadRes.status).toBe(200);
    const thread = await threadRes.json();
    expect(thread.name).toBe("Build feature");
    expect(thread.root_task_id).toBe(task.id);
    expect(thread.current_task_id).toBe(task.id);
    expect(thread.current_state).toBe("Starting work");
  });

  it("inherits the parent task thread when creating a child task", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const rootRes = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Root feature thread",
        domain_id: domain.id,
        created_by: "claude-code",
      }),
    });
    const root = await rootRes.json();

    const childRes = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Follow-up task",
        domain_id: domain.id,
        created_by: "openclaw",
        parent_task_id: root.id,
      }),
    });

    expect(childRes.status).toBe(201);
    const child = await childRes.json();
    expect(child.thread_id).toBe(root.thread_id);
    expect(child.parent_task_id).toBe(root.id);
  });

  it("lists tasks by thread_id", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const rootRes = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Thread root",
        domain_id: domain.id,
        created_by: "claude-code",
      }),
    });
    const root = await rootRes.json();

    await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Another task",
        domain_id: domain.id,
        created_by: "openclaw",
        thread_id: root.thread_id,
      }),
    });

    const res = await app.request(`/v1/tasks?thread_id=${root.thread_id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(2);
  });
});

describe("PATCH /v1/tasks/:id", () => {
  it("syncs the thread snapshot when task state changes", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const taskRes = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Sync thread",
        domain_id: domain.id,
        created_by: "claude-code",
        current_state: "Investigating",
      }),
    });
    const task = await taskRes.json();

    await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_state: "Implemented core thread sync",
        next_action: "Write tests",
        blockers: ["Need migration"],
        status: "in_progress",
      }),
    });

    const threadRes = await app.request(`/v1/threads/${task.thread_id}`);
    const thread = await threadRes.json();
    expect(thread.current_state).toBe("Implemented core thread sync");
    expect(thread.next_action).toBe("Write tests");
    expect(thread.blockers).toEqual(["Need migration"]);
    expect(thread.status).toBe("active");
  });
});
