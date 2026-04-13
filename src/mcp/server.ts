import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createThreadronMcp(apiUrl: string, apiKey: string, agentId: string): McpServer {
  function api(path: string, options: RequestInit = {}) {
    return fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(options.headers || {}),
      },
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(`API ${res.status}: ${(body as { error?: string }).error || res.statusText}`);
      }
      return res.json();
    });
  }

  const server = new McpServer({
    name: "threadron",
    version: "0.1.0",
  });

  // ─── List work items ─────────────────────────────────────────────────────────

  server.tool(
    "threadron_list_tasks",
    "List work items. Use on session start to see what's in progress, pending, or blocked. Filter by status, assignee, or domain.",
    {
      status: z.string().optional().describe("Filter: pending, in_progress, blocked, completed"),
      assignee: z.string().optional().describe("Filter by agent ID"),
      domain_id: z.string().optional().describe("Filter by domain ID"),
      search: z.string().optional().describe("Search title text"),
    },
    async ({ status, assignee, domain_id, search }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (assignee) params.set("assignee", assignee);
      if (domain_id) params.set("domain_id", domain_id);
      if (search) params.set("search", search);
      const qs = params.toString() ? `?${params}` : "";
      const data = await api(`/tasks${qs}`);
      const tasks = (data as { tasks?: unknown }).tasks || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
      };
    }
  );

  // ─── Get work item detail ─────────────────────────────────────────────────────

  server.tool(
    "threadron_get_task",
    "Get full work item detail including goal, current_state, next_action, blockers, timeline, and artifacts. Use before starting work on an item.",
    {
      task_id: z.string().describe("Work item ID"),
    },
    async ({ task_id }) => {
      const data = await api(`/tasks/${task_id}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Create work item ─────────────────────────────────────────────────────────

  server.tool(
    "threadron_create_task",
    "Create a new work item. Always set goal and outcome_definition. Set current_state and next_action if known.",
    {
      title: z.string().describe("Short title of the work item"),
      domain_id: z.string().describe("Domain ID this belongs to"),
      goal: z.string().optional().describe("What this work aims to achieve"),
      current_state: z.string().optional().describe("Current state of the work"),
      next_action: z.string().optional().describe("What should happen next"),
      outcome_definition: z.string().optional().describe("What done looks like"),
      assignee: z.string().optional().describe("Agent to assign to"),
      priority: z.string().optional().describe("low, medium, high, urgent"),
      project_id: z.string().optional().describe("Project ID"),
    },
    async (params) => {
      const data = await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...params,
          created_by: agentId,
          assignee: params.assignee || agentId,
        }),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Update work item state ───────────────────────────────────────────────────

  server.tool(
    "threadron_update_state",
    "Update work item. Use for execution state (current_state, next_action, blockers) and also for reassigning, changing project, tags, priority, or goal.",
    {
      task_id: z.string().describe("Work item ID"),
      status: z.string().optional().describe("pending, in_progress, blocked, completed"),
      current_state: z.string().optional().describe("What's the current state right now"),
      next_action: z.string().optional().describe("What should happen next"),
      blockers: z.array(z.string()).optional().describe("Active blockers (set to [] to clear)"),
      confidence: z.string().optional().describe("low, medium, high"),
      project_id: z.string().optional().describe("Move to a different project (pass project ID)"),
      assignee: z.string().optional().describe("Reassign to a different agent"),
      priority: z.string().optional().describe("low, medium, high, urgent"),
      tags: z.array(z.string()).optional().describe("Replace tags"),
      goal: z.string().optional().describe("Update the goal"),
      outcome_definition: z.string().optional().describe("Update what done looks like"),
    },
    async ({ task_id, ...updates }) => {
      const body: Record<string, unknown> = {
        _actor: agentId,
        _actor_type: "agent",
      };
      if (updates.status !== undefined) body.status = updates.status;
      if (updates.current_state !== undefined) body.current_state = updates.current_state;
      if (updates.next_action !== undefined) body.next_action = updates.next_action;
      if (updates.blockers !== undefined) body.blockers = updates.blockers;
      if (updates.confidence !== undefined) body.confidence = updates.confidence;
      if (updates.project_id !== undefined) body.project_id = updates.project_id;
      if (updates.assignee !== undefined) body.assignee = updates.assignee;
      if (updates.priority !== undefined) body.priority = updates.priority;
      if (updates.tags !== undefined) body.tags = updates.tags;
      if (updates.goal !== undefined) body.goal = updates.goal;
      if (updates.outcome_definition !== undefined) body.outcome_definition = updates.outcome_definition;

      const data = await api(`/tasks/${task_id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Add context / timeline entry ─────────────────────────────────────────────

  server.tool(
    "threadron_add_context",
    "Add an entry to the work item timeline. Use for observations, decisions, actions taken, blockers, handoff notes. This is the audit trail — be specific.",
    {
      task_id: z.string().describe("Work item ID"),
      type: z
        .enum([
          "observation",
          "action_taken",
          "decision",
          "blocker",
          "handoff",
          "proposal",
          "state_transition",
        ])
        .describe("Entry type"),
      body: z.string().describe("What happened, what was decided, what was observed"),
    },
    async ({ task_id, type, body }) => {
      const data = await api(`/tasks/${task_id}/context`, {
        method: "POST",
        body: JSON.stringify({ type, body, author: agentId, actor_type: "agent" }),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Create artifact ──────────────────────────────────────────────────────────

  server.tool(
    "threadron_create_artifact",
    "Attach an artifact to a work item — a branch, PR, commit, file, plan, doc, or terminal output. Always record meaningful outputs.",
    {
      task_id: z.string().describe("Work item ID"),
      type: z
        .enum(["file", "branch", "commit", "pull_request", "patch", "plan", "doc", "terminal_output"])
        .describe("Artifact type"),
      title: z.string().describe("Short label"),
      uri: z.string().optional().describe("URL or file path"),
      body: z.string().optional().describe("Inline content (for terminal output, patches)"),
    },
    async ({ task_id, type, title, uri, body }) => {
      const data = await api(`/tasks/${task_id}/artifacts`, {
        method: "POST",
        body: JSON.stringify({ type, title, uri, body, created_by: agentId }),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Claim work item ──────────────────────────────────────────────────────────

  server.tool(
    "threadron_claim",
    "Claim a work item before starting. By default, exclusive — rejects if already claimed. Pass allow_parallel: true to join as a parallel worker alongside other agents.",
    {
      task_id: z.string().describe("Work item ID to claim"),
      duration_minutes: z.number().optional().describe("How long to hold the claim (default 60)"),
      allow_parallel: z.boolean().optional().describe("If true, multiple agents can work this item simultaneously. Use for fan-out work that will be reconciled."),
    },
    async ({ task_id, duration_minutes, allow_parallel }) => {
      const data = await api(`/tasks/${task_id}/claim`, {
        method: "POST",
        body: JSON.stringify({
          agent_id: agentId,
          duration_minutes: duration_minutes || 60,
          allow_parallel: allow_parallel || false,
        }),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Release claim ────────────────────────────────────────────────────────────

  server.tool(
    "threadron_release",
    "Release your claim on a work item. Do this when you're done or pausing.",
    {
      task_id: z.string().describe("Work item ID to release"),
    },
    async ({ task_id }) => {
      const data = await api(`/tasks/${task_id}/release`, { method: "POST" });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── List domains ─────────────────────────────────────────────────────────────

  server.tool(
    "threadron_list_domains",
    "List available domains (organizational groups for work items).",
    {},
    async () => {
      const data = await api("/domains");
      const domains = (data as { domains?: unknown }).domains || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(domains, null, 2) }],
      };
    }
  );

  // ─── Create project ──────────────────────────────────────────────────────────

  server.tool(
    "threadron_create_project",
    "Create a project within a domain. Projects group related work items. Use threadron_list_domains to find domain IDs first.",
    {
      name: z.string().describe("Project name"),
      domain_id: z.string().describe("Domain ID this project belongs to"),
      description: z.string().optional().describe("Project description"),
    },
    async ({ name, domain_id, description }) => {
      const data = await api("/projects", {
        method: "POST",
        body: JSON.stringify({ name, domain_id, description }),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── List projects ──────────────────────────────────────────────────────────

  server.tool(
    "threadron_list_projects",
    "List projects. Optionally filter by domain.",
    {
      domain_id: z.string().optional().describe("Filter by domain ID"),
    },
    async ({ domain_id }) => {
      const qs = domain_id ? `?domain_id=${domain_id}` : "";
      const data = await api(`/projects${qs}`);
      const projects = (data as { projects?: unknown }).projects || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
      };
    }
  );

  // ─── List agents ──────────────────────────────────────────────────────────────

  server.tool(
    "threadron_list_agents",
    "List registered agents and their last activity.",
    {},
    async () => {
      const data = await api("/agents");
      const agents = (data as { agents?: unknown }).agents || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(agents, null, 2) }],
      };
    }
  );

  // ─── Session check-in (composite) ────────────────────────────────────────────

  server.tool(
    "threadron_checkin",
    "Session start check-in. Returns your in-progress work, pending items, and any blocked items. Use this at the start of every session to understand what needs attention.",
    {},
    async () => {
      const [inProgress, pending, blocked] = await Promise.all([
        api(`/tasks?assignee=${agentId}&status=in_progress`).then((d) => (d as { tasks?: unknown[] }).tasks || d),
        api(`/tasks?assignee=${agentId}&status=pending`).then((d) => (d as { tasks?: unknown[] }).tasks || d),
        api(`/tasks?status=blocked`).then((d) => (d as { tasks?: unknown[] }).tasks || d),
      ]);

      const inProgressArr = inProgress as unknown[];
      const pendingArr = pending as unknown[];
      const blockedArr = blocked as unknown[];

      const summary = {
        in_progress: inProgressArr,
        pending: pendingArr,
        blocked: blockedArr,
        summary: `${inProgressArr.length} in progress, ${pendingArr.length} pending, ${blockedArr.length} blocked`,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  return server;
}
