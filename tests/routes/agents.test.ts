import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { agentRoutes } from "../../src/routes/agents.js";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.client.end();
});

function buildApp() {
  const app = new Hono().basePath("/v1");
  app.route("/agents", agentRoutes(ctx.db));
  return app;
}

describe("POST /v1/agents", () => {
  it("registers an agent with its own ID", async () => {
    const app = buildApp();

    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "claude-code",
        name: "Claude Code",
        type: "coding",
        capabilities: ["read_files", "write_files", "run_tests"],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("claude-code");
    expect(body.name).toBe("Claude Code");
    expect(body.type).toBe("coding");
    expect(body.capabilities).toEqual(["read_files", "write_files", "run_tests"]);
    expect(body.last_seen).toBeDefined();
  });

  it("registers an agent with default type", async () => {
    const app = buildApp();

    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "worker-1", name: "Worker" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("generic");
  });
});

describe("GET /v1/agents", () => {
  it("lists all agents", async () => {
    const app = buildApp();

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "agent-a", name: "Agent A" }),
    });
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "agent-b", name: "Agent B" }),
    });

    const res = await app.request("/v1/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(2);
  });
});

describe("GET /v1/agents/:id", () => {
  it("returns a single agent by ID", async () => {
    const app = buildApp();

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "my-agent",
        name: "My Agent",
        type: "analyst",
      }),
    });

    const res = await app.request("/v1/agents/my-agent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("my-agent");
    expect(body.type).toBe("analyst");
  });

  it("returns 404 for nonexistent agent", async () => {
    const app = buildApp();
    const res = await app.request("/v1/agents/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/agents/:id", () => {
  it("updates agent capabilities", async () => {
    const app = buildApp();

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "updatable-agent",
        name: "Updatable Agent",
        capabilities: ["basic"],
      }),
    });

    const res = await app.request("/v1/agents/updatable-agent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capabilities: ["basic", "advanced", "expert"],
        name: "Super Agent",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Super Agent");
    expect(body.capabilities).toEqual(["basic", "advanced", "expert"]);
  });

  it("returns 404 for nonexistent agent", async () => {
    const app = buildApp();
    const res = await app.request("/v1/agents/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });
});
