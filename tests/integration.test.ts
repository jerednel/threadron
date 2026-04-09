/**
 * Full integration test — agent lifecycle from setup through task completion.
 *
 * Tests the entire wired-up app (auth middleware + all route modules) without
 * importing the global app from index.ts to avoid the serve() call.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createTestContext } from "./helpers/api.js";
import { authMiddleware } from "../src/middleware/auth.js";
import { authPublicRoutes, authProtectedRoutes } from "../src/routes/auth.js";
import { domainRoutes } from "../src/routes/domains.js";
import { projectRoutes } from "../src/routes/projects.js";
import { taskRoutes } from "../src/routes/tasks.js";
import { contextRoutes } from "../src/routes/context.js";
import { agentRoutes } from "../src/routes/agents.js";
import { configRoutes } from "../src/routes/config.js";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.client.end();
});

function buildApp() {
  const app = new Hono().basePath("/v1");
  app.use("/*", cors());

  // Public routes
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/auth", authPublicRoutes(ctx.db));

  // Protected sub-app
  const protected_ = new Hono();
  protected_.use("/*", authMiddleware(ctx.db));
  protected_.route("/auth", authProtectedRoutes(ctx.db));
  protected_.route("/domains", domainRoutes(ctx.db));
  protected_.route("/projects", projectRoutes(ctx.db));
  protected_.route("/tasks", taskRoutes(ctx.db));
  protected_.route("/tasks", contextRoutes(ctx.db));
  protected_.route("/agents", agentRoutes(ctx.db));
  protected_.route("/config", configRoutes(ctx.db));

  app.route("/", protected_);
  return app;
}

describe("Full agent lifecycle integration", () => {
  it("completes the full lifecycle from setup through task completion", async () => {
    const app = buildApp();

    // ─── 1. Health check ────────────────────────────────────────────────────
    const healthRes = await app.request("/v1/health");
    expect(healthRes.status).toBe(200);
    const healthBody = await healthRes.json();
    expect(healthBody).toEqual({ status: "ok" });

    // ─── 2. Initial setup — get API key ─────────────────────────────────────
    const setupRes = await app.request("/v1/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "integration-test-key" }),
    });
    expect(setupRes.status).toBe(201);
    const setupBody = await setupRes.json();
    expect(setupBody.api_key).toMatch(/^tfa_sk_/);
    const apiKey = setupBody.api_key;

    const auth = { Authorization: `Bearer ${apiKey}` };

    // ─── 3. Register agent "claude-code" ────────────────────────────────────
    const agentRes = await app.request("/v1/agents", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "claude-code",
        name: "Claude Code",
        type: "coding-agent",
        capabilities: ["code-generation", "debugging"],
      }),
    });
    expect(agentRes.status).toBe(201);
    const agentBody = await agentRes.json();
    expect(agentBody.id).toBe("claude-code");
    expect(agentBody.name).toBe("Claude Code");

    // ─── 4. Create domain "Work" with approval_required guardrail ───────────
    const workDomainRes = await app.request("/v1/domains", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Work",
        default_guardrail: "approval_required",
      }),
    });
    expect(workDomainRes.status).toBe(201);
    const workDomain = await workDomainRes.json();
    expect(workDomain.name).toBe("Work");
    expect(workDomain.default_guardrail).toBe("approval_required");
    const workDomainId = workDomain.id;

    // ─── 5. Create domain "Personal" with autonomous guardrail ──────────────
    const personalDomainRes = await app.request("/v1/domains", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Personal",
        default_guardrail: "autonomous",
      }),
    });
    expect(personalDomainRes.status).toBe(201);
    const personalDomain = await personalDomainRes.json();
    expect(personalDomain.name).toBe("Personal");
    expect(personalDomain.default_guardrail).toBe("autonomous");

    // ─── 6. Set config: onboarding_complete + approval_behavior ────────────
    const onboardingRes = await app.request("/v1/config", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ key: "onboarding_complete", value: true }),
    });
    expect(onboardingRes.status).toBe(201);
    const onboardingBody = await onboardingRes.json();
    expect(onboardingBody.key).toBe("onboarding_complete");
    expect(onboardingBody.value).toBe(true);

    const approvalRes = await app.request("/v1/config", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "approval_behavior",
        value: "collect_and_summarize",
      }),
    });
    expect(approvalRes.status).toBe(201);

    // ─── 7. Create project "API v2" in Work domain ──────────────────────────
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API v2",
        domain_id: workDomainId,
        description: "Version 2 of the public API",
      }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();
    expect(project.name).toBe("API v2");
    expect(project.domain_id).toBe(workDomainId);
    const projectId = project.id;

    // ─── 8. Create task in API v2 project assigned to claude-code ───────────
    const taskRes = await app.request("/v1/tasks", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fix connection pool race condition",
        domain_id: workDomainId,
        created_by: "claude-code",
        project_id: projectId,
        assignee: "claude-code",
        priority: "high",
        tags: ["bug", "backend", "database"],
      }),
    });
    expect(taskRes.status).toBe(201);
    const task = await taskRes.json();
    expect(task.title).toBe("Fix connection pool race condition");
    expect(task.status).toBe("pending");
    expect(task.assignee).toBe("claude-code");
    expect(task.domain_id).toBe(workDomainId);
    expect(task.project_id).toBe(projectId);
    expect(task.tags).toEqual(["bug", "backend", "database"]);
    const taskId = task.id;

    // ─── 9. Claim task (PATCH status to in_progress) ────────────────────────
    const claimRes = await app.request(`/v1/tasks/${taskId}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    expect(claimRes.status).toBe(200);
    const claimedTask = await claimRes.json();
    expect(claimedTask.status).toBe("in_progress");

    // ─── 10. Add 3 context entries: observation, decision, artifact ─────────
    const obsRes = await app.request(`/v1/tasks/${taskId}/context`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "observation",
        body: "Race condition occurs when two workers acquire connection simultaneously under high load.",
        author: "claude-code",
      }),
    });
    expect(obsRes.status).toBe(201);
    const obsEntry = await obsRes.json();
    expect(obsEntry.type).toBe("observation");
    expect(obsEntry.task_id).toBe(taskId);

    const decRes = await app.request(`/v1/tasks/${taskId}/context`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "decision",
        body: "Decided to use a mutex lock around connection acquisition rather than a semaphore.",
        author: "claude-code",
      }),
    });
    expect(decRes.status).toBe(201);

    const artRes = await app.request(`/v1/tasks/${taskId}/context`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "artifact",
        body: "diff --git a/src/pool.ts b/src/pool.ts\n+  await mutex.acquire();\n+  try {\n+    return pool.acquire();\n+  } finally {\n+    mutex.release();\n+  }",
        author: "claude-code",
      }),
    });
    expect(artRes.status).toBe(201);

    // ─── 11. Complete task ───────────────────────────────────────────────────
    const completeRes = await app.request(`/v1/tasks/${taskId}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    expect(completeRes.status).toBe(200);
    const completedTask = await completeRes.json();
    expect(completedTask.status).toBe("completed");

    // ─── 12. Verify full task: status=completed, tags present ───────────────
    const getTaskRes = await app.request(`/v1/tasks/${taskId}`, {
      headers: auth,
    });
    expect(getTaskRes.status).toBe(200);
    const fullTask = await getTaskRes.json();
    expect(fullTask.id).toBe(taskId);
    expect(fullTask.status).toBe("completed");
    expect(fullTask.title).toBe("Fix connection pool race condition");
    expect(fullTask.tags).toEqual(["bug", "backend", "database"]);
    expect(fullTask.assignee).toBe("claude-code");

    // ─── 13. Verify context log has 5 entries (3 manual + 2 auto state_transition) ──
    const contextRes = await app.request(`/v1/tasks/${taskId}/context`, {
      headers: auth,
    });
    expect(contextRes.status).toBe(200);
    const contextBody = await contextRes.json();
    // 2 status changes (pending→in_progress, in_progress→completed) fire auto-events
    expect(contextBody.context).toHaveLength(5);
    // The 3 manually created entries are present
    const manualEntries = contextBody.context.filter(
      (e: { type: string }) => ["observation", "decision", "artifact"].includes(e.type)
    );
    expect(manualEntries).toHaveLength(3);
    expect(manualEntries[0].type).toBe("observation");
    expect(manualEntries[1].type).toBe("decision");
    expect(manualEntries[2].type).toBe("artifact");
    // 2 auto-generated state_transition entries exist
    const autoEntries = contextBody.context.filter(
      (e: { type: string }) => e.type === "state_transition"
    );
    expect(autoEntries).toHaveLength(2);
    // All entries belong to the correct task
    contextBody.context.forEach((entry: { task_id: string }) => {
      expect(entry.task_id).toBe(taskId);
    });

    // ─── 14. Search for task by title ───────────────────────────────────────
    const searchRes = await app.request(
      "/v1/tasks?search=connection+pool",
      { headers: auth }
    );
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json();
    expect(searchBody.tasks.length).toBeGreaterThanOrEqual(1);
    const found = searchBody.tasks.find(
      (t: { id: string }) => t.id === taskId
    );
    expect(found).toBeDefined();
    expect(found.title).toBe("Fix connection pool race condition");

    // ─── 15. Verify config persists ─────────────────────────────────────────
    const cfgRes = await app.request("/v1/config/onboarding_complete", {
      headers: auth,
    });
    expect(cfgRes.status).toBe(200);
    const cfgBody = await cfgRes.json();
    expect(cfgBody.key).toBe("onboarding_complete");
    expect(cfgBody.value).toBe(true);

    const allCfgRes = await app.request("/v1/config", { headers: auth });
    expect(allCfgRes.status).toBe(200);
    const allCfgBody = await allCfgRes.json();
    const approvalCfg = allCfgBody.config.find(
      (c: { key: string }) => c.key === "approval_behavior"
    );
    expect(approvalCfg).toBeDefined();
    expect(approvalCfg.value).toBe("collect_and_summarize");
  });

  it("rejects protected endpoints without auth", async () => {
    const app = buildApp();

    const domainsRes = await app.request("/v1/domains");
    expect(domainsRes.status).toBe(401);

    const tasksRes = await app.request("/v1/tasks");
    expect(tasksRes.status).toBe(401);

    const agentsRes = await app.request("/v1/agents");
    expect(agentsRes.status).toBe(401);

    const configRes = await app.request("/v1/config");
    expect(configRes.status).toBe(401);
  });

  it("allows re-onboarding by updating config", async () => {
    const app = buildApp();

    // Setup
    const setupRes = await app.request("/v1/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "re-onboard-key" }),
    });
    const { api_key } = await setupRes.json();
    const auth = { Authorization: `Bearer ${api_key}` };

    // Set onboarding complete
    await app.request("/v1/config", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ key: "onboarding_complete", value: true }),
    });

    // Verify it's set
    const cfgRes = await app.request("/v1/config/onboarding_complete", { headers: auth });
    const cfgBody = await cfgRes.json();
    expect(cfgBody.value).toBe(true);

    // Reset via upsert (POST again)
    const resetRes = await app.request("/v1/config", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ key: "onboarding_complete", value: false }),
    });
    expect(resetRes.status).toBe(201);
    const resetBody = await resetRes.json();
    expect(resetBody.value).toBe(false);
  });
});
