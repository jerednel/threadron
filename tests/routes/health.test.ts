import { describe, it, expect } from "vitest";
import { app } from "../../src/index.js";

describe("GET /v1/health", () => {
  it("returns ok status", async () => {
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
