import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext, TEST_USER_ID } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { inboxRoutes } from "../../src/routes/inbox.js";
import { threadRoutes } from "../../src/routes/threads.js";
import { contextObjectRoutes } from "../../src/routes/contextObjects.js";

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
  app.route("/context-objects", contextObjectRoutes(ctx.db));
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

  it("promotes an inbox item into a standalone thread", async () => {
    const app = buildApp();

    const captureRes = await app.request("/v1/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "investigate flaky deploy health checks" }),
    });
    const inboxItem = await captureRes.json();

    const promoteRes = await app.request(`/v1/inbox/${inboxItem.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "thread",
        title: "Investigate flaky deploy health checks",
        next_action: "Read recent Railway deploy logs",
      }),
    });

    expect(promoteRes.status).toBe(200);
    const body = await promoteRes.json();
    expect(body.thread.id).toMatch(/^th_/);
    expect(body.thread.next_action).toBe("Read recent Railway deploy logs");
    expect(body.inbox_item.promoted_thread_id).toBe(body.thread.id);
  });

  it("remembers an inbox item as shared context instead of a task", async () => {
    const app = buildApp();

    const captureRes = await app.request("/v1/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "Jeremy prefers terse deploy summaries with exact commit hashes" }),
    });
    const inboxItem = await captureRes.json();

    const rememberRes = await app.request(`/v1/inbox/${inboxItem.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "note",
        context_type: "memory",
        title: "Deploy summary preference",
      }),
    });

    expect(rememberRes.status).toBe(200);
    const body = await rememberRes.json();
    expect(body.context_object.id).toMatch(/^ctxobj_/);
    expect(body.context_object.type).toBe("memory");
    expect(body.inbox_item.status).toBe("remembered");

    const contextRes = await app.request("/v1/context-objects?type=memory");
    expect(contextRes.status).toBe(200);
    const context = await contextRes.json();
    expect(context.objects).toHaveLength(1);
    expect(context.objects[0].body).toContain("terse deploy summaries");
  });

  it("attaches a promoted inbox task to an existing thread", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const threadRes = await app.request("/v1/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OpenClaw setup", current_state: "MCP transport works" }),
    });
    const thread = await threadRes.json();

    const captureRes = await app.request("/v1/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "add live-agent prompt eval", domain_id: domain.id }),
    });
    const inboxItem = await captureRes.json();

    const promoteRes = await app.request(`/v1/inbox/${inboxItem.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Add live-agent prompt eval",
        domain_id: domain.id,
        thread_id: thread.id,
      }),
    });

    expect(promoteRes.status).toBe(200);
    const body = await promoteRes.json();
    expect(body.task.thread_id).toBe(thread.id);

    const updatedThreadRes = await app.request(`/v1/threads/${thread.id}`);
    const updatedThread = await updatedThreadRes.json();
    expect(updatedThread.tasks).toHaveLength(1);
    expect(updatedThread.current_task_id).toBe(body.task.id);
  });
});
