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

async function createTask(app: Hono, domainId: string, overrides = {}) {
  const res = await app.request("/v1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Default Task",
      domain_id: domainId,
      created_by: "test-agent",
      ...overrides,
    }),
  });
  return res.json();
}

describe("POST /v1/tasks", () => {
  it("creates a task with required fields", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const res = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Implement feature",
        domain_id: domain.id,
        created_by: "claude-code",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^t_/);
    expect(body.title).toBe("Implement feature");
    expect(body.domain_id).toBe(domain.id);
    expect(body.created_by).toBe("claude-code");
    expect(body.status).toBe("pending");
    expect(body.priority).toBe("medium");
  });

  it("creates a task with tags and metadata", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const res = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Rich Task",
        domain_id: domain.id,
        created_by: "agent-1",
        tags: ["backend", "urgent"],
        metadata: { ticket: "PROJ-123", sprint: 5 },
        priority: "high",
        assignee: "dev-agent",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tags).toEqual(["backend", "urgent"]);
    expect(body.metadata).toEqual({ ticket: "PROJ-123", sprint: 5 });
    expect(body.priority).toBe("high");
    expect(body.assignee).toBe("dev-agent");
  });

  it("creates a task with new work item fields", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const res = await app.request("/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Agent Work Item",
        domain_id: domain.id,
        created_by: "claude-code",
        goal: "Refactor the authentication module",
        current_state: "Analysis phase — reviewing existing code",
        next_action: "Create a plan document",
        blockers: ["Waiting for access to prod logs"],
        outcome_definition: "Auth module passes all tests with <50ms response time",
        confidence: "medium",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.goal).toBe("Refactor the authentication module");
    expect(body.current_state).toBe("Analysis phase — reviewing existing code");
    expect(body.next_action).toBe("Create a plan document");
    expect(body.blockers).toEqual(["Waiting for access to prod logs"]);
    expect(body.outcome_definition).toBe("Auth module passes all tests with <50ms response time");
    expect(body.confidence).toBe("medium");
    expect(body.claimed_by).toBeNull();
    expect(body.claim_expires_at).toBeNull();
  });
});

describe("GET /v1/tasks", () => {
  it("filters tasks by assignee and status", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    await createTask(app, domain.id, { assignee: "agent-a", title: "Task 1" });
    await createTask(app, domain.id, { assignee: "agent-a", title: "Task 2" });
    await createTask(app, domain.id, { assignee: "agent-b", title: "Task 3" });

    // Patch task 1 to "done"
    const t1 = await createTask(app, domain.id, {
      assignee: "agent-a",
      title: "Task Done",
    });
    await app.request(`/v1/tasks/${t1.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    const res = await app.request(`/v1/tasks?assignee=agent-a&status=pending`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(2);
    body.tasks.forEach((t: { assignee: string; status: string }) => {
      expect(t.assignee).toBe("agent-a");
      expect(t.status).toBe("pending");
    });
  });

  it("filters tasks by domain_id", async () => {
    const app = buildApp();
    const domainA = await createDomain(app, "Domain A");
    const domainB = await createDomain(app, "Domain B");

    await createTask(app, domainA.id, { title: "A Task" });
    await createTask(app, domainB.id, { title: "B Task" });

    const res = await app.request(`/v1/tasks?domain_id=${domainA.id}`);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("A Task");
  });

  it("searches tasks by title (ilike)", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    await createTask(app, domain.id, { title: "Fix database migration bug" });
    await createTask(app, domain.id, { title: "Add new API endpoint" });
    await createTask(app, domain.id, { title: "Database performance tuning" });

    const res = await app.request(`/v1/tasks?search=database`);
    const body = await res.json();
    expect(body.tasks).toHaveLength(2);
  });
});

describe("GET /v1/tasks/:id", () => {
  it("returns a single task with all fields", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const created = await createTask(app, domain.id, {
      title: "Full Task",
      tags: ["tag1", "tag2"],
      metadata: { key: "value" },
    });

    const res = await app.request(`/v1/tasks/${created.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.tags).toEqual(["tag1", "tag2"]);
    expect(body.metadata).toEqual({ key: "value" });
  });

  it("returns context and artifacts arrays", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.context)).toBe(true);
    expect(Array.isArray(body.artifacts)).toBe(true);
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();
    const res = await app.request("/v1/tasks/t_nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/tasks/:id", () => {
  it("updates task status", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", assignee: "worker-agent" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("in_progress");
    expect(body.assignee).toBe("worker-agent");
  });

  it("updates new work item fields", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: "Ship the feature by Friday",
        current_state: "In review",
        next_action: "Address PR comments",
        blockers: ["PR has 2 unresolved comments"],
        confidence: "high",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal).toBe("Ship the feature by Friday");
    expect(body.current_state).toBe("In review");
    expect(body.next_action).toBe("Address PR comments");
    expect(body.blockers).toEqual(["PR has 2 unresolved comments"]);
    expect(body.confidence).toBe("high");
  });

  it("auto-generates state_transition event on status change", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", _actor: "claude-code", _actor_type: "agent" }),
    });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    const body = await res.json();
    const event = body.context.find((e: any) => e.type === "state_transition");
    expect(event).toBeDefined();
    expect(event.body).toContain("pending");
    expect(event.body).toContain("in_progress");
    expect(event.author).toBe("claude-code");
    expect(event.actor_type).toBe("agent");
  });

  it("auto-generates handoff event on assignee change", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id, { assignee: "agent-a" });

    await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee: "agent-b" }),
    });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    const body = await res.json();
    const event = body.context.find((e: any) => e.type === "handoff");
    expect(event).toBeDefined();
    expect(event.body).toContain("agent-a");
    expect(event.body).toContain("agent-b");
  });

  it("does not generate events when status unchanged", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    // Patch with same status
    await app.request(`/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    const body = await res.json();
    expect(body.context).toHaveLength(0);
  });
});

describe("DELETE /v1/tasks/:id", () => {
  it("deletes a task", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const deleteRes = await app.request(`/v1/tasks/${task.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const body = await deleteRes.json();
    expect(body.deleted).toBe(true);

    const getRes = await app.request(`/v1/tasks/${task.id}`);
    expect(getRes.status).toBe(404);
  });
});
