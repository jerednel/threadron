import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext, TEST_USER_ID } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { inboxRoutes } from "../../src/routes/inbox.js";
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
  app.route("/inbox", inboxRoutes(ctx.db));
  app.route("/threads", threadRoutes(ctx.db));
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

describe("POST /v1/inbox/:id/promote", () => {
  it("promotes an inbox item into a task with a durable thread", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const captureRes = await app.request("/v1/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: "wire Hermes and OpenClaw into shared state",
        domain_id: domain.id,
      }),
    });
    expect(captureRes.status).toBe(201);
    const inboxItem = await captureRes.json();

    const promoteRes = await app.request(`/v1/inbox/${inboxItem.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Wire Hermes and OpenClaw into Threadron",
        next_action: "Configure both agents with the Threadron MCP endpoint",
        domain_id: domain.id,
        owner: "codex",
      }),
    });

    expect(promoteRes.status).toBe(200);
    const body = await promoteRes.json();
    expect(body.task.thread_id).toMatch(/^th_/);
    expect(body.task.next_action).toBe("Configure both agents with the Threadron MCP endpoint");

    const threadRes = await app.request(`/v1/threads/${body.task.thread_id}`);
    expect(threadRes.status).toBe(200);
    const thread = await threadRes.json();
    expect(thread.status).toBe("active");
    expect(thread.root_task_id).toBe(body.task.id);
    expect(thread.current_task_id).toBe(body.task.id);
    expect(thread.next_action).toBe("Configure both agents with the Threadron MCP endpoint");
  });
});
