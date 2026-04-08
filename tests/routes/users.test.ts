import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createTestContext } from "../helpers/api.js";
import { userPublicRoutes, userProtectedRoutes } from "../../src/routes/users.js";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.client.end();
});

function buildApp() {
  const app = new Hono().basePath("/v1");
  app.route("/users", userPublicRoutes(ctx.db));
  app.route("/users", userProtectedRoutes(ctx.db));
  return app;
}

describe("POST /v1/users/register", () => {
  it("creates user and returns JWT + API key", async () => {
    const app = buildApp();
    const res = await app.request("/v1/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
        name: "Alice",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("alice@example.com");
    expect(body.user.name).toBe("Alice");
    expect(body.user.id).toMatch(/^u_/);
    expect(body.token).toBeTruthy();
    expect(body.api_key).toMatch(/^tfa_sk_/);
  });

  it("returns 409 for duplicate email", async () => {
    const app = buildApp();

    // Register once
    await app.request("/v1/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "password123",
        name: "Alice",
      }),
    });

    // Try to register again with the same email
    const res = await app.request("/v1/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "differentpassword",
        name: "Alice2",
      }),
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /v1/users/login", () => {
  it("returns JWT with correct credentials", async () => {
    const app = buildApp();

    // Register first
    await app.request("/v1/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bob@example.com",
        password: "securepass",
        name: "Bob",
      }),
    });

    // Login
    const res = await app.request("/v1/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bob@example.com",
        password: "securepass",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("bob@example.com");
    expect(body.token).toBeTruthy();
  });

  it("returns 401 for wrong password", async () => {
    const app = buildApp();

    // Register
    await app.request("/v1/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "charlie@example.com",
        password: "correctpassword",
        name: "Charlie",
      }),
    });

    // Login with wrong password
    const res = await app.request("/v1/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "charlie@example.com",
        password: "wrongpassword",
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /v1/users/me", () => {
  it("returns user info with valid JWT", async () => {
    const app = buildApp();

    // Register
    const registerRes = await app.request("/v1/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dave@example.com",
        password: "mypassword",
        name: "Dave",
      }),
    });
    const { token, user } = await registerRes.json();

    // Get /me
    const res = await app.request("/v1/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("dave@example.com");
    expect(body.user.id).toBe(user.id);
    expect(Array.isArray(body.api_keys)).toBe(true);
    expect(body.api_keys.length).toBeGreaterThan(0);
    expect(Array.isArray(body.domains)).toBe(true);
  });

  it("returns 401 without JWT", async () => {
    const app = buildApp();

    const res = await app.request("/v1/users/me");
    expect(res.status).toBe(401);
  });
});
