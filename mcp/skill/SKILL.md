---
name: threadron
description: Track work across sessions using Threadron shared execution state. Automatically checks in at session start, updates state as you work, and records artifacts.
---

# Threadron — Shared Execution State

You have access to Threadron tools for tracking work across sessions. Use them to maintain continuity — so the next session (yours or another agent's) knows exactly where things stand.

## CRITICAL RULES

### Rule 1: One work item = one discrete goal

A work item is a **single, specific thing** that can be completed. NOT a category, NOT a role, NOT a bucket of tasks.

Good work items:
- "Fix connection pool race condition in api-v2"
- "Write migration rollback tests for the users table"
- "Research and recommend a WebSocket library for Hono"
- "Deploy v0.2 to staging and run smoke tests"

Bad work items:
- "Handle all backend tasks" ← too broad, this is a role not a task
- "Bain work" ← this is a category, not a goal
- "Various fixes and improvements" ← vague, no clear outcome
- "Work on the project" ← meaningless

If the user asks you to do multiple unrelated things, create **separate work items** for each one. If a task is too big to describe in one sentence, break it into smaller work items.

### Rule 2: Always pair state updates with context

**Every time you change what you're doing, call BOTH:**
1. `threadron_add_context` — to explain WHY in the timeline (what you observed, decided, or did)
2. `threadron_update_state` — to update the structured fields (current_state, next_action, blockers)

State fields tell the next reader WHAT. Context entries tell them WHY. Both are required. A state update without a context entry leaves the timeline empty and useless for handoff.

### Rule 3: Don't create work items for everything

Only create work items for work that:
- Spans more than a quick exchange (multi-step, multi-session)
- Benefits from tracking state across sessions
- Involves handoff between agents or devices
- Has a clear goal and outcome

Do NOT create work items for:
- Simple questions the user asks
- One-off commands that are done in seconds
- Casual conversation
- Things the user didn't ask you to track

When in doubt, **ask the user** if they want you to track something in Threadron.

### Rule 4: Identify yourself

When setting up the MCP connection, pass your agent name via the `X-Agent-Id` header. Each agent should have a unique identity — "openclaw", "hermes", "claude-code", etc. Don't reuse another agent's identity. If you see work claimed by another agent, that's a different agent — don't take over their work without the user's permission.

## Session Start

At the **start of every session**, call `threadron_checkin` to see:
- Work items you left in progress (resume these first)
- Pending items assigned to you
- Blocked items that need attention

If there's in-progress work, call `threadron_get_task` on it to read the full state (goal, current_state, next_action, blockers, timeline, artifacts) before doing anything else.

**Don't announce the check-in verbosely.** A brief "Checking Threadron... I have 2 items in progress" is fine. Don't dump the full JSON to the user.

## While Working

When you're actively working on a Threadron work item, follow this pattern at EVERY meaningful step:

### The Update Pattern (use this every time something changes)

```
1. threadron_add_context  → log what happened (observation, decision, action_taken)
2. threadron_update_state → update current_state and next_action
```

Always log context FIRST, then update state. This ensures the timeline explains every state change.

### Examples:

- You investigate something → `add_context(type: "observation", body: "Found X")` → `update_state(current_state: "Investigated, found X")`
- You make a choice → `add_context(type: "decision", body: "Going with approach A because...")` → `update_state(next_action: "Implement approach A")`
- You complete a step → `add_context(type: "action_taken", body: "Deployed to staging")` → `update_state(current_state: "Deployed to staging", next_action: "Run smoke tests")`
- You hit a wall → `add_context(type: "blocker", body: "Need API key for service X")` → `update_state(blockers: ["Need API key for service X"])`

### Starting work

1. **Claim it** — `threadron_claim` before starting (prevents other agents from colliding)
   - If another agent already claimed it, you'll get a 409 error
   - If the user explicitly wants parallel work (e.g., "have both of you work on this"), use `allow_parallel: true` to join alongside the other agent
   - Parallel claims are for fan-out work that will be reconciled later — don't use them by default
2. **Update status** — `threadron_update_state(status: "in_progress")`

### Producing outputs

- `threadron_create_artifact` for branches, PRs, files, plans, terminal output
- Always pair with `threadron_add_context(type: "action_taken", body: "Created branch X")`

**Important — file artifacts:** For files you create (markdown, SQL, configs, templates, plans), include the file contents in the `body` field. Do NOT use `uri` with a local file path or a made-up URL — those will 404 in the dashboard. Only use `uri` for things that are actually hosted URLs (GitHub PRs, branches, deployed docs).

Good: `create_artifact(type: "file", title: "DBT QA Template", body: "# QA Template\n\n...")`
Bad: `create_artifact(type: "file", title: "DBT QA Template", uri: "https://threadron.com/docs/template.md")`

## Session End / Pausing

Before the session ends or when switching to other work:

1. `threadron_add_context(type: "action_taken", body: "Pausing. Summary of what was done...")` — summarize the session
2. `threadron_update_state` — set `current_state` and `next_action` to exactly what the next session needs to know
3. `threadron_release` — release the claim so other agents can pick it up
4. If done: `threadron_update_state(status: "completed")`

## Creating New Work

When you identify new work to be done:

1. **Check scope** — Is this a single, discrete goal? Can you describe the outcome in one sentence? If not, break it up.
2. `threadron_list_tasks` with `search` to check it doesn't already exist
3. `threadron_create_task` with at minimum: title, domain_id, goal, and outcome_definition
4. Set `current_state` and `next_action` if you know them
5. **One work item per goal.** Never bundle unrelated tasks into one work item.

## Key Principles

**Write state for the next reader, not for yourself.** The whole point is that a different session — possibly a different agent — should be able to pick up any work item and immediately understand what's going on without re-investigating.

**The timeline IS the story.** If the timeline is empty, the work item is useless for handoff. Every state change needs a context entry explaining it.

**Threadron is not a to-do list.** It's shared execution state. Use it for work that needs continuity, not for cataloging everything the user mentions.
