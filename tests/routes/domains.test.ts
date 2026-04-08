import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";

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
  return app;
}

describe("POST /v1/domains", () => {
  it("creates a domain with default guardrail", async () => {
    const app = buildApp();
    const res = await app.request("/v1/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Engineering" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^d_/);
    expect(body.name).toBe("Engineering");
    expect(body.default_guardrail).toBe("autonomous");
    expect(body.created_at).toBeDefined();
  });

  it("creates a domain with custom guardrail", async () => {
    const app = buildApp();
    const res = await app.request("/v1/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Security", default_guardrail: "supervised" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.default_guardrail).toBe("supervised");
  });
});

describe("GET /v1/domains", () => {
  it("lists all domains", async () => {
    const app = buildApp();

    await app.request("/v1/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Domain A" }),
    });
    await app.request("/v1/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Domain B" }),
    });

    const res = await app.request("/v1/domains");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domains).toHaveLength(2);
    expect(body.domains[0].name).toBe("Domain A");
    expect(body.domains[1].name).toBe("Domain B");
  });
});

describe("PATCH /v1/domains/:id", () => {
  it("updates domain name and guardrail", async () => {
    const app = buildApp();

    const createRes = await app.request("/v1/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Old Name" }),
    });
    const { id } = await createRes.json();

    const patchRes = await app.request(`/v1/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name", default_guardrail: "manual" }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.name).toBe("New Name");
    expect(body.default_guardrail).toBe("manual");
  });

  it("returns 404 for nonexistent domain", async () => {
    const app = buildApp();
    const res = await app.request("/v1/domains/d_nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /v1/domains/:id", () => {
  it("deletes a domain", async () => {
    const app = buildApp();

    const createRes = await app.request("/v1/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "To Delete" }),
    });
    const { id } = await createRes.json();

    const deleteRes = await app.request(`/v1/domains/${id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const body = await deleteRes.json();
    expect(body.deleted).toBe(true);

    // Verify it's gone
    const listRes = await app.request("/v1/domains");
    const listBody = await listRes.json();
    expect(listBody.domains).toHaveLength(0);
  });

  it("returns 404 for nonexistent domain", async () => {
    const app = buildApp();
    const res = await app.request("/v1/domains/d_nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
