import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { domainRoutes } from "../../src/routes/domains.js";
import { projectRoutes } from "../../src/routes/projects.js";

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
  app.route("/projects", projectRoutes(ctx.db));
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

describe("POST /v1/projects", () => {
  it("creates a project in a domain", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Project", domain_id: domain.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^p_/);
    expect(body.name).toBe("My Project");
    expect(body.domain_id).toBe(domain.id);
    expect(body.description).toBeNull();
  });

  it("creates a project with description", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Described Project",
        domain_id: domain.id,
        description: "A detailed description",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.description).toBe("A detailed description");
  });
});

describe("GET /v1/projects", () => {
  it("lists all projects", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Project A", domain_id: domain.id }),
    });
    await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Project B", domain_id: domain.id }),
    });

    const res = await app.request("/v1/projects");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(2);
  });

  it("filters projects by domain_id", async () => {
    const app = buildApp();
    const domainA = await createDomain(app, "Domain A");
    const domainB = await createDomain(app, "Domain B");

    await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Project in A", domain_id: domainA.id }),
    });
    await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Project in B", domain_id: domainB.id }),
    });

    const res = await app.request(`/v1/projects?domain_id=${domainA.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe("Project in A");
  });
});

describe("GET /v1/projects/:id", () => {
  it("returns a single project", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Single Project", domain_id: domain.id }),
    });
    const { id } = await createRes.json();

    const res = await app.request(`/v1/projects/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.name).toBe("Single Project");
  });

  it("returns 404 for nonexistent project", async () => {
    const app = buildApp();
    const res = await app.request("/v1/projects/p_nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /v1/projects/:id", () => {
  it("deletes a project", async () => {
    const app = buildApp();
    const domain = await createDomain(app);

    const createRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "To Delete", domain_id: domain.id }),
    });
    const { id } = await createRes.json();

    const deleteRes = await app.request(`/v1/projects/${id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const body = await deleteRes.json();
    expect(body.deleted).toBe(true);

    const getRes = await app.request(`/v1/projects/${id}`);
    expect(getRes.status).toBe(404);
  });
});
