import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createThreadronMcp } from "../mcp/server.js";

export function mcpRoutes() {
  const router = new Hono();

  router.post("/", async (c) => {
    const authHeader = c.req.header("Authorization");
    const apiKey = authHeader?.replace("Bearer ", "").trim() || "";

    if (!apiKey) {
      return c.json({ error: "API key required. Pass your Threadron API key as: Authorization: Bearer <key>" }, 401);
    }

    // For the hosted MCP endpoint, always use internal localhost to avoid DNS loops
    const port = process.env.PORT || "8080";
    const apiUrl = `http://localhost:${port}/v1`;

    // Derive agent ID: X-Agent-Id header > API key name > "unknown-agent"
    let agentId = c.req.header("X-Agent-Id") || "";
    if (!agentId) {
      // Look up the API key to get its name as a fallback agent ID
      try {
        const keyRes = await fetch(`${apiUrl}/auth/keys`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (keyRes.ok) {
          const data = await keyRes.json();
          const keys = data.keys || [];
          const match = keys.find((k: { key_prefix: string }) => apiKey.startsWith(k.key_prefix.replace("...", "")));
          if (match?.agent_id) {
            agentId = match.agent_id;
          } else if (match?.name) {
            agentId = match.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
          }
        }
      } catch {
        // ignore lookup failure
      }
      if (!agentId) agentId = "unknown-agent";
    }

    const server = createThreadronMcp(apiUrl, apiKey, agentId);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — new transport per request
    });

    await server.connect(transport);

    return transport.handleRequest(c.req.raw);
  });

  // GET — used by some MCP clients for SSE streams; not supported in stateless mode
  router.get("/", async (c) => {
    return c.json(
      { error: "Method not allowed. Use POST for MCP requests." },
      405
    );
  });

  // DELETE — session teardown (no-op in stateless mode)
  router.delete("/", async (c) => {
    return c.json({ ok: true }, 200);
  });

  return router;
}
