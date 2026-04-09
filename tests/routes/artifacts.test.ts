import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { taskRoutes } from "../../src/routes/tasks.js";
import { contextRoutes } from "../../src/routes/context.js";
import { artifactRoutes, artifactLookupRoutes } from "../../src/routes/artifacts.js";

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
  app.route("/tasks", artifactRoutes(ctx.db));
  app.route("/artifacts", artifactLookupRoutes(ctx.db));
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

async function createArtifact(app: Hono, taskId: string, overrides = {}) {
  const res = await app.request(`/v1/tasks/${taskId}/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "file",
      title: "main.py",
      uri: "https://github.com/org/repo/blob/main/main.py",
      created_by: "claude-code",
      ...overrides,
    }),
  });
  return res.json();
}

describe("POST /v1/tasks/:id/artifacts", () => {
  it("creates an artifact on a task", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pull_request",
        uri: "https://github.com/org/repo/pull/42",
        title: "Fix auth bug",
        created_by: "claude-code",
        metadata: { pr_number: 42 },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^art_/);
    expect(body.task_id).toBe(task.id);
    expect(body.type).toBe("pull_request");
    expect(body.uri).toBe("https://github.com/org/repo/pull/42");
    expect(body.title).toBe("Fix auth bug");
    expect(body.created_by).toBe("claude-code");
    expect(body.metadata).toEqual({ pr_number: 42 });
  });

  it("creates an artifact with inline body content", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "terminal_output",
        body: "$ npm test\n✓ 42 tests passed",
        title: "Test run output",
        created_by: "ci-agent",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("terminal_output");
    expect(body.body).toBe("$ npm test\n✓ 42 tests passed");
    expect(body.uri).toBeNull();
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();

    const res = await app.request("/v1/tasks/t_nonexistent/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "file", created_by: "agent" }),
    });

    expect(res.status).toBe(404);
  });

  it("auto-generates artifact_created context event", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await createArtifact(app, task.id, { title: "patch.diff", type: "patch" });

    const res = await app.request(`/v1/tasks/${task.id}/context`);
    const body = await res.json();
    const event = body.context.find((e: any) => e.type === "artifact_created");
    expect(event).toBeDefined();
    expect(event.body).toContain("patch.diff");
    expect(event.author).toBe("claude-code");
  });
});

describe("GET /v1/tasks/:id/artifacts", () => {
  it("lists artifacts for a task", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await createArtifact(app, task.id, { type: "file", title: "file1.py" });
    await createArtifact(app, task.id, { type: "commit", title: "abc1234" });

    const res = await app.request(`/v1/tasks/${task.id}/artifacts`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artifacts).toHaveLength(2);
    expect(body.artifacts[0].title).toBe("file1.py");
    expect(body.artifacts[1].title).toBe("abc1234");
  });

  it("returns empty list for task with no artifacts", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const res = await app.request(`/v1/tasks/${task.id}/artifacts`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artifacts).toHaveLength(0);
  });

  it("returns 404 for nonexistent task", async () => {
    const app = buildApp();
    const res = await app.request("/v1/tasks/t_nonexistent/artifacts");
    expect(res.status).toBe(404);
  });

  it("artifacts appear in GET /tasks/:id response", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    await createArtifact(app, task.id, { type: "plan", title: "execution plan" });

    const res = await app.request(`/v1/tasks/${task.id}`);
    const body = await res.json();
    expect(body.artifacts).toHaveLength(1);
    expect(body.artifacts[0].title).toBe("execution plan");
  });
});

describe("GET /v1/artifacts/:id", () => {
  it("gets a single artifact by id", async () => {
    const app = buildApp();
    const domain = await createDomain(app);
    const task = await createTask(app, domain.id);

    const artifact = await createArtifact(app, task.id, { type: "branch", title: "feature/auth-refactor" });

    const res = await app.request(`/v1/artifacts/${artifact.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(artifact.id);
    expect(body.type).toBe("branch");
    expect(body.title).toBe("feature/auth-refactor");
  });

  it("returns 404 for nonexistent artifact", async () => {
    const app = buildApp();
    const res = await app.request("/v1/artifacts/art_nonexistent");
    expect(res.status).toBe(404);
  });
});
