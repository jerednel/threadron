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
      thread_id: z.string().optional().describe("Filter by thread ID"),
      search: z.string().optional().describe("Search title text"),
    },
    async ({ status, assignee, domain_id, thread_id, search }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (assignee) params.set("assignee", assignee);
      if (domain_id) params.set("domain_id", domain_id);
      if (thread_id) params.set("thread_id", thread_id);
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

  // ─── Thread operations ───────────────────────────────────────────────────────

  server.tool(
    "threadron_list_threads",
    "List durable execution threads. Use this to find the shared thread that survives across agents and machines.",
    {
      status: z.string().optional().describe("Filter: active, paused, completed, archived"),
      search: z.string().optional().describe("Search thread name or state text"),
      source: z.string().optional().describe("Filter by source string"),
    },
    async ({ status, search, source }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (source) params.set("source", source);
      const qs = params.toString() ? `?${params}` : "";
      const data = await api(`/threads${qs}`);
      const threads = (data as { threads?: unknown }).threads || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(threads, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_get_thread",
    "Get a thread with its latest state and member tasks. Use to resume a worktree or feature thread.",
    {
      thread_id: z.string().describe("Thread ID"),
    },
    async ({ thread_id }) => {
      const data = await api(`/threads/${thread_id}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_resume",
    "Return the exact resume snapshot for a thread. Use this instead of manually reconstructing state from scattered tasks.",
    {
      thread_id: z.string().describe("Thread ID"),
    },
    async ({ thread_id }) => {
      const data = await api(`/threads/${thread_id}`);
      const thread = data as {
        id?: string;
        name?: string;
        status?: string;
        current_state?: string | null;
        next_action?: string | null;
        blockers?: string[];
        outcome_definition?: string | null;
        confidence?: string | null;
        current_task_id?: string | null;
        root_task_id?: string | null;
        tasks?: Array<Record<string, unknown>>;
      };
      const tasks = Array.isArray(thread.tasks) ? thread.tasks : [];
      const focusTask =
        tasks.find((task) => task.id === thread.current_task_id) ||
        tasks.find((task) => task.status === "in_progress") ||
        tasks.find((task) => task.status === "blocked") ||
        tasks[0] ||
        null;

      const resumeSnapshot = {
        thread_id: thread.id,
        thread_name: thread.name,
        status: thread.status,
        current_state: thread.current_state,
        next_action: thread.next_action,
        blockers: thread.blockers || [],
        outcome_definition: thread.outcome_definition,
        confidence: thread.confidence,
        current_task_id: thread.current_task_id,
        root_task_id: thread.root_task_id,
        focus_task: focusTask,
        task_count: tasks.length,
        open_task_count: tasks.filter((task) => {
          const status = String(task.status || "");
          return status === "pending" || status === "in_progress" || status === "blocked";
        }).length,
        recommended_next_step: thread.next_action || (focusTask?.next_action as string | undefined) || thread.current_state || "Open the thread and continue from the latest state.",
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(resumeSnapshot, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_create_thread",
    "Create a durable execution thread. Use when starting a new worktree or feature stream that multiple agents may touch.",
    {
      name: z.string().describe("Thread name"),
      source: z.string().optional().describe("Optional worktree/repo/source identifier"),
      status: z.string().optional().describe("active, paused, completed, archived"),
      current_state: z.string().optional().describe("Current state of the thread"),
      next_action: z.string().optional().describe("Next action for the thread"),
      blockers: z.array(z.string()).optional().describe("Current blockers"),
      outcome_definition: z.string().optional().describe("What done looks like"),
      confidence: z.string().optional().describe("low, medium, high"),
      parent_thread_id: z.string().optional().describe("Optional parent thread for lineage"),
      root_task_id: z.string().optional().describe("Optional root task that started this thread"),
    },
    async (params) => {
      const data = await api("/threads", {
        method: "POST",
        body: JSON.stringify(params),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_update_thread",
    "Update a thread's durable snapshot. Use this to keep the shared execution state current across sessions and agents.",
    {
      thread_id: z.string().describe("Thread ID"),
      name: z.string().optional().describe("Rename the thread"),
      status: z.string().optional().describe("active, paused, completed, archived"),
      current_state: z.string().optional().describe("Current state of the thread"),
      next_action: z.string().optional().describe("Next action for the thread"),
      blockers: z.array(z.string()).optional().describe("Replace blockers"),
      outcome_definition: z.string().optional().describe("Update what done looks like"),
      confidence: z.string().optional().describe("low, medium, high"),
      source: z.string().optional().describe("Update source identifier"),
    },
    async ({ thread_id, ...updates }) => {
      const data = await api(`/threads/${thread_id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
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
      thread_id: z.string().optional().describe("Attach to an existing thread"),
      parent_task_id: z.string().optional().describe("Link this as a child task of another task"),
      thread_name: z.string().optional().describe("Name for a newly created thread if thread_id is omitted"),
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
    "Update work item. Use for execution state (current_state, next_action, blockers) and also for reassigning, changing domain, project, tags, priority, or goal.",
    {
      task_id: z.string().describe("Work item ID"),
      status: z.string().optional().describe("pending, in_progress, blocked, completed"),
      current_state: z.string().optional().describe("What's the current state right now"),
      next_action: z.string().optional().describe("What should happen next"),
      blockers: z.array(z.string()).optional().describe("Active blockers (set to [] to clear)"),
      confidence: z.string().optional().describe("low, medium, high"),
      domain_id: z.string().optional().describe("Move to a different domain (pass domain ID)"),
      project_id: z.string().optional().describe("Move to a different project (pass project ID)"),
      assignee: z.string().optional().describe("Reassign to a different agent"),
      priority: z.string().optional().describe("low, medium, high, urgent"),
      tags: z.array(z.string()).optional().describe("Replace tags"),
      goal: z.string().optional().describe("Update the goal"),
      outcome_definition: z.string().optional().describe("Update what done looks like"),
      thread_id: z.string().optional().describe("Move task to a different thread"),
      parent_task_id: z.string().optional().describe("Set or clear task lineage by linking to a parent task"),
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
      if (updates.domain_id !== undefined) body.domain_id = updates.domain_id;
      if (updates.project_id !== undefined) body.project_id = updates.project_id;
      if (updates.assignee !== undefined) body.assignee = updates.assignee;
      if (updates.priority !== undefined) body.priority = updates.priority;
      if (updates.tags !== undefined) body.tags = updates.tags;
      if (updates.goal !== undefined) body.goal = updates.goal;
      if (updates.outcome_definition !== undefined) body.outcome_definition = updates.outcome_definition;
      if (updates.thread_id !== undefined) body.thread_id = updates.thread_id;
      if (updates.parent_task_id !== undefined) body.parent_task_id = updates.parent_task_id;

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

  // ─── Delete project ─────────────────────────────────────────────────────────

  server.tool(
    "threadron_delete_project",
    "Delete a project by ID. Existing work items remain and are moved to no project.",
    {
      project_id: z.string().describe("Project ID to delete"),
    },
    async ({ project_id }) => {
      const data = await api(`/projects/${project_id}`, { method: "DELETE" });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
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
    "Session start check-in. Returns your active threads, active sprints, in-progress work, pending items, blocked items, and unprocessed inbox items. Use this at the start of every session to understand what needs attention.",
    {},
    async () => {
      const [threadsData, sprintsData, inProgress, pending, blocked, inbox] = await Promise.all([
        api(`/threads?status=active`).then((d) => (d as { threads?: unknown[] }).threads || d).catch(() => []),
        api(`/sprints?status=active`).then((d) => (d as { sprints?: unknown[] }).sprints || d).catch(() => []),
        api(`/tasks?assignee=${agentId}&status=in_progress`).then((d) => (d as { tasks?: unknown[] }).tasks || d),
        api(`/tasks?assignee=${agentId}&status=pending`).then((d) => (d as { tasks?: unknown[] }).tasks || d),
        api(`/tasks?status=blocked`).then((d) => (d as { tasks?: unknown[] }).tasks || d),
        api(`/inbox?status=unprocessed`).then((d) => (d as { items?: unknown[] }).items || d).catch(() => []),
      ]);

      const threadArr = threadsData as unknown[];
      const sprintArr = sprintsData as unknown[];
      const inProgressArr = inProgress as unknown[];
      const pendingArr = pending as unknown[];
      const blockedArr = blocked as unknown[];
      const inboxArr = inbox as unknown[];

      const summary = {
        active_threads: threadArr,
        active_sprints: sprintArr,
        in_progress: inProgressArr,
        pending: pendingArr,
        blocked: blockedArr,
        unprocessed_inbox: inboxArr,
        summary: `${threadArr.length} active threads, ${sprintArr.length} active sprints, ${inProgressArr.length} in progress, ${pendingArr.length} pending, ${blockedArr.length} blocked, ${inboxArr.length} inbox items to parse`,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  // ─── Inbox: List items ──────────────────────────────────────────────────────

  server.tool(
    "threadron_list_inbox",
    "List inbox items. Use at session start to find unprocessed items that need parsing. Filter by status to see what needs attention.",
    {
      status: z.string().optional().describe("Filter: unprocessed, processing, parsed, promoted, rejected, error"),
    },
    async ({ status }) => {
      const qs = status ? `?status=${status}` : "";
      const data = await api(`/inbox${qs}`);
      const items = (data as { items?: unknown[] }).items || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
      };
    }
  );

  // ─── Inbox: Parse item (propose structure) ────────────────────────────────────

  server.tool(
    "threadron_parse_inbox",
    "Parse an unprocessed inbox item — interpret the raw text and propose structured task fields. Set status to 'processing' first, then 'parsed' with your interpretation. Always include a concrete next_action.",
    {
      item_id: z.string().describe("Inbox item ID"),
      title: z.string().describe("Proposed task title — clear and actionable"),
      next_action: z.string().describe("Concrete next step — what should happen first"),
      project: z.string().optional().describe("Suggested project name"),
      owner: z.string().optional().describe("Suggested owner/assignee"),
      confidence: z.string().describe("Confidence in interpretation: 0.0 to 1.0 as string"),
    },
    async ({ item_id, title, next_action, project, owner, confidence }) => {
      // Mark as processing first
      await api(`/inbox/${item_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "processing" }),
      });

      // Submit parsed proposal
      const fields: Record<string, unknown> = {
        status: "parsed",
        parsed_title: title,
        parsed_next_action: next_action,
        parsed_confidence: confidence,
      };
      if (project) fields.parsed_project = project;
      if (owner) fields.parsed_owner = owner;

      const data = await api(`/inbox/${item_id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Inbox: Capture item ──────────────────────────────────────────────────────

  server.tool(
    "threadron_capture_inbox",
    "Capture a new inbox item. Use when the user mentions something that should be tracked but isn't a fully formed task yet.",
    {
      raw_text: z.string().describe("Raw text to capture"),
      domain_id: z.string().optional().describe("Optional domain ID"),
    },
    async ({ raw_text, domain_id }) => {
      const body: Record<string, unknown> = { raw_text, source: "agent" };
      if (domain_id) body.domain_id = domain_id;
      const data = await api("/inbox", { method: "POST", body: JSON.stringify(body) });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Shared context objects ─────────────────────────────────────────────────

  server.tool(
    "threadron_list_context",
    "List shared context objects: notes, decisions, resources, questions, people/orgs, incidents, routines, and memories. Use when you need facts to remember, not tasks to execute.",
    {
      type: z.string().optional().describe("Filter: note, decision, resource, question, person, org, incident, routine, memory"),
      status: z.string().optional().describe("Filter by status, usually active or archived"),
      domain_id: z.string().optional().describe("Filter by domain ID"),
      thread_id: z.string().optional().describe("Filter by thread ID"),
      search: z.string().optional().describe("Search title/body"),
    },
    async ({ type, status, domain_id, thread_id, search }) => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      if (domain_id) params.set("domain_id", domain_id);
      if (thread_id) params.set("thread_id", thread_id);
      if (search) params.set("search", search);
      const qs = params.toString() ? `?${params}` : "";
      const data = await api(`/context-objects${qs}`);
      const objects = (data as { objects?: unknown[] }).objects || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(objects, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_create_context",
    "Create a shared context object. Use this for durable notes, decisions, resources, questions, incidents, routines, people/org context, and stable memories. Do not use this for actionable work; create a task instead.",
    {
      type: z.string().describe("note, decision, resource, question, person, org, incident, routine, memory"),
      title: z.string().describe("Short human-readable title"),
      body: z.string().describe("The durable context to remember"),
      domain_id: z.string().optional().describe("Optional domain ID"),
      thread_id: z.string().optional().describe("Optional thread ID"),
      status: z.string().optional().describe("Usually active or archived"),
    },
    async ({ type, title, body, domain_id, thread_id, status }) => {
      const payload: Record<string, unknown> = {
        type,
        title,
        body,
        source: "agent",
        created_by: agentId,
      };
      if (domain_id) payload.domain_id = domain_id;
      if (thread_id) payload.thread_id = thread_id;
      if (status) payload.status = status;
      const data = await api("/context-objects", { method: "POST", body: JSON.stringify(payload) });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── Sprint planning overlay ────────────────────────────────────────────────

  server.tool(
    "threadron_list_sprints",
    "List planning sprints. Use when the user asks what is in the current sprint, what is planned this week, or what slipped from a time-boxed focus set.",
    {
      status: z.string().optional().describe("Filter: planned, active, closed"),
      domain_id: z.string().optional().describe("Optional domain ID"),
    },
    async ({ status, domain_id }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (domain_id) params.set("domain_id", domain_id);
      const qs = params.toString() ? `?${params}` : "";
      const data = await api(`/sprints${qs}`);
      const sprints = (data as { sprints?: unknown[] }).sprints || data;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(sprints, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_create_sprint",
    "Create a sprint as an optional planning overlay. Sprints group tasks and threads for a time-boxed focus period; they do not replace projects or execution state.",
    {
      name: z.string().describe("Sprint name"),
      domain_id: z.string().optional().describe("Optional domain ID"),
      goal: z.string().optional().describe("Sprint goal"),
      start_date: z.string().optional().describe("ISO date/time"),
      end_date: z.string().optional().describe("ISO date/time"),
      status: z.string().optional().describe("planned, active, closed"),
      capacity_notes: z.string().optional().describe("Human planning notes about capacity or scope"),
    },
    async ({ name, domain_id, goal, start_date, end_date, status, capacity_notes }) => {
      const payload: Record<string, unknown> = { name, created_by: agentId };
      if (domain_id) payload.domain_id = domain_id;
      if (goal) payload.goal = goal;
      if (start_date) payload.start_date = start_date;
      if (end_date) payload.end_date = end_date;
      if (status) payload.status = status;
      if (capacity_notes) payload.capacity_notes = capacity_notes;
      const data = await api("/sprints", { method: "POST", body: JSON.stringify(payload) });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_get_sprint",
    "Get a sprint with its task/thread focus items. Use for sprint review, current sprint planning, and rollover decisions.",
    {
      sprint_id: z.string().describe("Sprint ID"),
    },
    async ({ sprint_id }) => {
      const data = await api(`/sprints/${sprint_id}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "threadron_add_sprint_item",
    "Add exactly one task or exactly one thread to a sprint. Use when the user says to add something to the current sprint, next sprint, committed work, or stretch work. Pass either task_id or thread_id, never both.",
    {
      sprint_id: z.string().describe("Sprint ID"),
      task_id: z.string().optional().describe("Task ID to add. Do not pass thread_id when this is set."),
      thread_id: z.string().optional().describe("Thread ID to add. Do not pass task_id when this is set."),
      commitment_status: z.string().optional().describe("planned, committed, stretch, removed"),
      position: z.number().optional().describe("Sort position"),
    },
    async ({ sprint_id, task_id, thread_id, commitment_status, position }) => {
      if (!task_id && !thread_id) {
        return {
          content: [{ type: "text" as const, text: "Error: pass exactly one of task_id or thread_id." }],
          isError: true,
        };
      }
      if (task_id && thread_id) {
        return {
          content: [{ type: "text" as const, text: "Error: pass either task_id or thread_id, not both. Prefer task_id when adding a concrete task; use thread_id only for standalone thread focus." }],
          isError: true,
        };
      }
      const payload: Record<string, unknown> = { added_by: agentId };
      if (task_id) payload.task_id = task_id;
      if (thread_id) payload.thread_id = thread_id;
      if (commitment_status) payload.commitment_status = commitment_status;
      if (position !== undefined) payload.position = position;
      const data = await api(`/sprints/${sprint_id}/items`, { method: "POST", body: JSON.stringify(payload) });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  return server;
}
