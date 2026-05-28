import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext, TEST_USER_ID } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { sprintRoutes } from "../../src/routes/sprints.js";
import { taskRoutes } from "../../src/routes/tasks.js";
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
  app.route("/tasks", taskRoutes(ctx.db));
  app.route("/threads", threadRoutes(ctx.db));
  app.route("/sprints", sprintRoutes(ctx.db));
  return app;
}

async function createDomain(app: Hono, name = "Work") {
  const res = await app.request("/v1/domains", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

async function createTask(app: Hono, domainId: string, title = "Build sprint support") {
  const res = await app.request("/v1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      domain_id: domainId,
      created_by: "codex",
      current_state: "Ready",
      next_action: "Start",
    }),
  });
  return res.json();
}

describe("sprints", () => {
  it("creates and lists a sprint", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const createRes = await app.request("/v1/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Threadron onboarding week",
        domain_id: domain.id,
        status: "active",
        goal: "Make onboarding seamless",
        start_date: "2026-05-25T00:00:00.000Z",
        end_date: "2026-05-29T00:00:00.000Z",
      }),
    });

    expect(createRes.status).toBe(201);
    const sprint = await createRes.json();
    expect(sprint.id).toMatch(/^sp_/);
    expect(sprint.status).toBe("active");
    expect(sprint.domain_id).toBe(domain.id);

    const listRes = await app.request("/v1/sprints?status=active");
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.sprints).toHaveLength(1);
    expect(list.sprints[0].name).toBe("Threadron onboarding week");
    expect(list.sprints[0].item_count).toBe(0);
  });

  it("adds task and thread items to a sprint", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const sprintRes = await app.request("/v1/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Current Sprint", domain_id: domain.id, status: "active" }),
    });
    const sprint = await sprintRes.json();

    const taskItemRes = await app.request(`/v1/sprints/${sprint.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id, commitment_status: "committed", position: 1 }),
    });
    expect(taskItemRes.status).toBe(201);

    const threadItemRes = await app.request(`/v1/sprints/${sprint.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: task.thread_id, commitment_status: "stretch", position: 2 }),
    });
    expect(threadItemRes.status).toBe(201);

    const detailRes = await app.request(`/v1/sprints/${sprint.id}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.items).toHaveLength(2);
    expect(detail.items[0].task.title).toBe("Build sprint support");
    expect(detail.items[0].commitment_status).toBe("committed");
    expect(detail.items[1].thread.name).toBe("Build sprint support");
  });

  it("rejects task items from another domain when sprint has a domain", async () => {
    const app = buildApp();
    const domainA = await createDomain(app, "A");
    const domainB = await createDomain(app, "B");
    const task = await createTask(app, domainB.id, "Wrong domain task");

    const sprintRes = await app.request("/v1/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Domain A Sprint", domain_id: domainA.id }),
    });
    const sprint = await sprintRes.json();

    const res = await app.request(`/v1/sprints/${sprint.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id }),
    });

    expect(res.status).toBe(404);
  });
});
