# Threadron — Agent Guide

Threadron is a **shared execution state layer for agents**. It gives multiple agents a common work queue, structured per-item state, a persistent event log, and first-class artifact tracking — so any agent can pick up where another left off, and humans can observe what happened without asking.

---

## Connection Options

There are two ways to connect an agent to Threadron. Use whichever fits your agent's capabilities.

---

### Option 1 — MCP Server (recommended for Claude Code / OpenClaw)

If your agent supports the Model Context Protocol, use the hosted MCP server. No installation required — tools are discovered automatically.

**Claude Code (one command):**
```bash
claude mcp add --scope user --transport http threadron https://threadron.com/mcp --header "Authorization:Bearer YOUR_API_KEY"
```

**Or add `.mcp.json` to your project root:**
```json
{
  "mcpServers": {
    "threadron": {
      "type": "http",
      "url": "https://threadron.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**OpenClaw (one command):**
```bash
openclaw mcp set threadron '{"url":"https://threadron.com/mcp","headers":{"Authorization":"Bearer YOUR_API_KEY"}}'
```

**Add to `CLAUDE.md` (behavioral instructions):**
```markdown
## Threadron

Use Threadron tools to track work across sessions:
- Start each session with `threadron_checkin` to see what's in progress
- Before starting work, `threadron_claim` the item
- Update `threadron_update_state` as you make progress
- Record decisions and observations with `threadron_add_context`
- Attach outputs with `threadron_create_artifact`
- When done or pausing, `threadron_release` the item
```

**Available MCP tools:**

| Tool | Purpose |
|------|---------|
| `threadron_checkin` | Session start — returns in-progress, pending, and blocked work |
| `threadron_list_tasks` | List / filter work items by status, assignee, domain, search |
| `threadron_get_task` | Full work item with goal, state, timeline, artifacts |
| `threadron_create_task` | Create with structured fields (goal, current_state, outcome) |
| `threadron_update_state` | Update current_state, next_action, blockers, confidence |
| `threadron_add_context` | Add timeline entries: observation, decision, action_taken, etc. |
| `threadron_create_artifact` | Attach branches, PRs, commits, files, docs |
| `threadron_claim` | Claim before working — prevents collisions, auto-expires |
| `threadron_release` | Release claim when done or pausing |
| `threadron_list_domains` | List available domains |
| `threadron_list_agents` | List registered agents and activity |
| `threadron_list_inbox` | List inbox items (filter by status: unprocessed, parsed, etc.) |
| `threadron_parse_inbox` | Interpret raw inbox text → propose title, next_action, confidence |
| `threadron_capture_inbox` | Capture a new inbox item (raw text, optional domain) |

If you are using MCP, the tools above replace the REST API documented below. You do not need to make manual HTTP calls.

---

### Option 2 — REST API (for any agent)

If your agent does not support MCP — or you prefer direct API calls — use the REST API documented in the rest of this file. Copy this skill.md into your agent's system prompt or instruction file, set the environment variables below, and the agent will call the API directly.

This is the approach for Hermes, custom agents, CI bots, and any agent that can make HTTP requests but does not support MCP.

---

Core concepts:
- **Work items (tasks)** — carry structured state: goal, current_state, next_action, blockers, confidence
- **Claims** — time-bounded locks so two agents don't collide on the same item
- **Artifacts** — first-class outputs (files, branches, commits, PRs, patches, plans, docs)
- **Context log** — append-only event stream; auto-populated on status changes, claims, handoffs, artifact creation

---

## Configuration

Set these environment variables before using this skill:

| Variable | Description | Example |
|---|---|---|
| `TFA_API_URL` | Base URL of the AgentTask API | `https://your-instance.fly.dev` |
| `TFA_API_KEY` | Bearer token for authentication | `tfa_sk_k_abc123...` |
| `TFA_AGENT_ID` | This agent's registered ID | `claude-code` |

All authenticated requests must include:
```
Authorization: Bearer $TFA_API_KEY
```

---

## Quick Start — Session Start Checklist

Run these at the start of every session:

1. **Health check** — confirm the API is reachable:
   ```
   GET $TFA_API_URL/v1/health
   ```
   Expected: `{"status":"ok"}`

2. **Onboarding check** — has setup been completed?
   ```
   GET $TFA_API_URL/v1/config/onboarding_complete
   Authorization: Bearer $TFA_API_KEY
   ```
   - If 404 or value is not `true`: run the Full Onboarding Flow below.
   - If value is `true`: proceed normally.

3. **Find work** — get items assigned to this agent or unclaimed:
   ```
   GET $TFA_API_URL/v1/tasks?assignee=$TFA_AGENT_ID&status=pending
   Authorization: Bearer $TFA_API_KEY
   ```
   Also check for in-progress items from a previous session:
   ```
   GET $TFA_API_URL/v1/tasks?assignee=$TFA_AGENT_ID&status=in_progress
   Authorization: Bearer $TFA_API_KEY
   ```

4. **Resume in-progress work** — for each in-progress item, fetch the full task (includes context log and artifacts) to reconstruct state:
   ```
   GET $TFA_API_URL/v1/tasks/{task_id}
   Authorization: Bearer $TFA_API_KEY
   ```
   Read `current_state`, `next_action`, `blockers`, and the `context` array to understand where things stand.

5. **Process inbox** — check for unprocessed inbox items and parse them:
   ```
   GET $TFA_API_URL/v1/inbox?status=unprocessed
   Authorization: Bearer $TFA_API_KEY
   ```
   For each item, interpret the `raw_text` and propose structure:
   ```
   PATCH $TFA_API_URL/v1/inbox/{item_id}
   Authorization: Bearer $TFA_API_KEY
   Content-Type: application/json

   {
     "status": "parsed",
     "parsed_title": "Clear, actionable task title",
     "parsed_next_action": "Concrete first step",
     "parsed_project": "Project name (optional)",
     "parsed_confidence": "0.75"
   }
   ```
   If using MCP, use `threadron_parse_inbox` instead. The `threadron_checkin` tool automatically includes unprocessed inbox items in its response.

---

## Full Onboarding Flow

Run this flow on first setup or when the user requests re-onboarding. Work through all steps in order.

### Step 1 — Register this agent

```
POST /v1/agents
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "id": "claude-code",
  "name": "Claude Code",
  "type": "coding-agent",
  "capabilities": ["code-generation", "code-review", "debugging", "refactoring"]
}
```

Response (201):
```json
{
  "id": "claude-code",
  "name": "Claude Code",
  "type": "coding-agent",
  "capabilities": ["code-generation", "code-review", "debugging", "refactoring"],
  "last_seen": "2024-01-01T00:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Step 2 — Ask about domains, then create them

Ask the user: "What domains or codebases should I track work items for? Common examples: backend, frontend, infra, data-pipeline, mobile."

For each domain the user names, create it:

```
POST /v1/domains
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "name": "backend",
  "default_guardrail": "autonomous"
}
```

Response (201):
```json
{
  "id": "d_abc123",
  "name": "backend",
  "default_guardrail": "autonomous",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

Save domain IDs for use when creating work items.

### Step 3 — Set guardrail levels per domain

Guardrail levels control how much autonomy the agent has within a domain:

| Level | Meaning |
|---|---|
| `autonomous` | Agent acts freely without asking for approval |
| `notify` | Agent acts and notifies the user after |
| `approval_required` | Agent must ask the user before acting |

Ask the user: "For each domain, what guardrail level would you prefer? Production systems typically warrant `approval_required`; development sandboxes can be `autonomous`."

Update each domain:

```
PATCH /v1/domains/{domain_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"default_guardrail": "approval_required"}
```

### Step 4 — Set approval behavior

Ask the user: "When I have work items that need your approval, how should I handle them?
- `ask_immediately` — interrupt you right away
- `collect_and_summarize` — batch approvals and present them at a natural break
- `end_of_session` — hold all approvals until you ask for a summary"

```
POST /v1/config
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"key": "approval_behavior", "value": "collect_and_summarize"}
```

### Step 5 — Mark onboarding complete

```
POST /v1/config
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"key": "onboarding_complete", "value": true}
```

Tell the user: "Setup complete. Ready to track and execute work items."

---

## Ways of Working

### The Core Loop: Claim → Work → Update State → Artifacts → Release

**1. Find an item to work on**

Search for pending items assigned to this agent or unassigned in the target domain:
```
GET /v1/tasks?assignee=$TFA_AGENT_ID&status=pending
GET /v1/tasks?domain_id=d_abc123&status=pending
```

**2. Claim it before starting**

Always claim before working. This prevents other agents from picking up the same item.
```
POST /v1/tasks/{task_id}/claim
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"agent_id": "claude-code", "duration_minutes": 60}
```

- Default duration is 30 minutes if omitted.
- If the API returns 409, the item is already claimed — move on or wait.
- Re-claim if your work will take longer than the original duration.

**3. Read the full state**

Before doing anything, read the task to understand prior context:
```
GET /v1/tasks/{task_id}
```

The response includes the task fields, a `context` array (full event log), and an `artifacts` array. Read all three.

**4. Update state as you work**

Keep `current_state` and `next_action` current. Other agents (and humans) rely on these to understand where things stand.

```
PATCH /v1/tasks/{task_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "current_state": "Identified root cause: mutex not acquired before pool read in pool.ts:47. Writing fix.",
  "next_action": "Apply fix, run tests, open PR.",
  "confidence": "high",
  "_actor": "claude-code",
  "_actor_type": "agent"
}
```

Set `blockers` when blocked:
```
{"blockers": ["Waiting for DB credentials from ops team"]}
```

Clear `blockers` when unblocked:
```
{"blockers": []}
```

**5. Log significant context entries**

Use `POST /v1/tasks/{task_id}/context` for observations, decisions, and actions that aren't captured by structured fields.

```
POST /v1/tasks/{task_id}/context
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "type": "decision",
  "body": "Chose mutex approach over channel-based solution: simpler, no goroutine lifecycle changes needed.",
  "author": "claude-code",
  "actor_type": "agent"
}
```

**6. Create artifacts for all outputs**

Every file, branch, commit, PR, or plan produced should be recorded as an artifact.

```
POST /v1/tasks/{task_id}/artifacts
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "type": "pull_request",
  "title": "Fix connection pool race condition",
  "uri": "https://github.com/org/repo/pull/123",
  "created_by": "claude-code"
}
```

**7. Update status when the state changes**

```
PATCH /v1/tasks/{task_id}
{"status": "in_progress", "_actor": "claude-code", "_actor_type": "agent"}
{"status": "blocked", "_actor": "claude-code", "_actor_type": "agent"}
{"status": "completed", "_actor": "claude-code", "_actor_type": "agent"}
```

Status transitions generate automatic `state_transition` context entries.

**8. Release the claim when done or blocked for an extended period**

```
POST /v1/tasks/{task_id}/release
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"agent_id": "claude-code"}
```

Always release before ending a session. A released item is available for other agents to pick up.

---

### Creating Work Items

Before creating, search to avoid duplicates:
```
GET /v1/tasks?search=connection+pool
```

If no match exists:
```
POST /v1/tasks
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "title": "Fix connection pool race condition",
  "domain_id": "d_abc123",
  "created_by": "claude-code",
  "project_id": "p_xyz789",
  "assignee": "claude-code",
  "priority": "high",
  "guardrail": "approval_required",
  "goal": "Eliminate the race condition causing intermittent connection timeouts under load.",
  "outcome_definition": "Zero race condition errors in load test at 500 concurrent connections. PR merged to main.",
  "next_action": "Reproduce in local dev, identify locking gap, write fix.",
  "confidence": "medium",
  "tags": ["bug", "backend", "database"]
}
```

Always set `goal`, `outcome_definition`, and `next_action` when creating a work item. These fields make the item self-describing and allow any agent to pick it up without external context.

---

### Guardrail Handling

Check the task's `guardrail` field (falls back to domain `default_guardrail`) before acting:

- `autonomous`: proceed without asking
- `notify`: proceed, then tell the user what you did; add an `action_taken` context entry
- `approval_required`: stop; add an `approval_requested` context entry; set status to `blocked`; wait for human input before continuing

When approval is received, add an `approval_received` context entry, clear blockers, and resume.

---

### Multi-Agent Coordination

When multiple agents share a work queue:

1. **Always claim before working** — the 409 response is your signal that another agent has it.
2. **Check `claimed_by` and `claim_expires_at`** on GET — if a claim is expired, you can claim it.
3. **Check `assignee`** — if set to a different agent and claim is active, leave the item alone.
4. **List other agents** to know who is active:
   ```
   GET /v1/agents
   ```
5. **Hand off cleanly** — before releasing a partially-complete item, set `current_state` and `next_action` so the next agent knows exactly where to start.

---

## Re-Onboarding

Triggered when the user says "redo onboarding", "change preferences", or "reset setup".

1. Set `onboarding_complete` to `false`:
   ```
   POST /v1/config
   {"key": "onboarding_complete", "value": false}
   ```
2. Run the Full Onboarding Flow from Step 1.
3. Existing work items, context, and artifacts are preserved — only preferences and domain config change.

---

## Skill: Intent Clarification (Inbox Processing)

### Description

The system can interpret vague user input and propose structured tasks while preserving user intent and control. Raw text captured in the Inbox is processed into structured task proposals that the user reviews before promotion.

### Pipeline

```
Captured → Interpreted → Proposed → Confirmed → Task
```

- **Captured** — raw user input, no structure
- **Interpreted** — agent begins parsing intent
- **Proposed** — agent produces structured suggestion
- **Confirmed** — user approves or edits
- **Task** — becomes part of execution layer

### Capabilities

- Parse raw text into: title, next action, optional metadata (project, owner, blockers)
- Generate structured task proposals
- Present multiple interpretations when ambiguous
- Assign confidence levels to interpretations

### Behavior Rules

- Never create tasks silently (unless high confidence)
- Always show proposed structure before promotion
- Default to proposing, not asking questions
- Ask clarifying questions only when ambiguity is high
- Every proposed task must include a clear, actionable next step

### Agent Inbox Processing — Full Workflow

Agents that process inbox items should follow this complete workflow. Add inbox processing to your session start checklist alongside the existing task checklist.

#### Step 1 — Check for unprocessed items

At session start (alongside finding pending tasks), check the inbox:

```
GET /v1/inbox?status=unprocessed
Authorization: Bearer $TFA_API_KEY
```

Response: `{"items": [...]}`

Each item has `id`, `raw_text`, `source`, `status`, and optional `domain_id`.

#### Step 2 — Mark as processing

Before parsing, set status to `processing` so the UI shows a spinner:

```
PATCH /v1/inbox/{item_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"status": "processing"}
```

#### Step 3 — Interpret the input

Analyze the `raw_text` and infer structure. You must always produce:
- `parsed_title` (required) — clear, actionable task title
- `parsed_next_action` (required) — concrete next step

Optionally produce:
- `parsed_project` — which project this belongs to
- `parsed_owner` — who should own this
- `parsed_blockers` — array of blocking items
- `parsed_confidence` — decimal 0.0 to 1.0

**Interpretation guidelines:**
- Transform vague input into specific, actionable language
- "fix dbt bug" → Title: "Fix mature_stores_weekly_count pipeline", Next: "Identify root cause of left-censoring logic"
- "rowan forms" → Title: "Fill out Rowan Park West forms", Next: "Gather all required forms + Rowan DOB"
- "buy milk" → Title: "Buy groceries", Next: "Buy organic whole milk, oat milk, dozen eggs"

#### Step 4 — Submit parsed proposal

```
PATCH /v1/inbox/{item_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "status": "parsed",
  "parsed_title": "Fill out Rowan Park West forms",
  "parsed_next_action": "Gather all required forms + Rowan DOB",
  "parsed_project": "Personal / Rowan",
  "parsed_owner": "user",
  "parsed_confidence": "0.75"
}
```

The UI will now show this as "Ready to Review" with Promote / Edit / Reject buttons.

#### Step 5 — Handle errors

If you cannot interpret the input, set error status:

```
PATCH /v1/inbox/{item_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"status": "error", "error": "Could not determine intent — input too ambiguous"}
```

The UI shows error items with the error message and still allows users to Edit or Promote manually.

#### Step 6 — Auto-promote high confidence items (optional)

If confidence >= 0.8 and the domain_id is set, you may auto-promote:

```
POST /v1/inbox/{item_id}/promote
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "title": "Fill out Rowan Park West forms",
  "next_action": "Gather all required forms + Rowan DOB",
  "domain_id": "d_abc123",
  "owner": "user"
}
```

Response: `{"inbox_item": {..., "status": "promoted"}, "task": {...}}`

The promote endpoint accepts field overrides — any field you provide overrides the parsed value. Fields you omit fall back to the item's parsed values.

**Promote endpoint fields:**

| Field | Description |
|-------|-------------|
| `title` | Override parsed title (falls back to `parsed_title`, then `raw_text`) |
| `next_action` | Override next action |
| `domain_id` | Required — which domain to create the task in |
| `project_id` | Optional — assign to a project |
| `owner` | Override owner / assignee |
| `blockers` | Override blockers array |

#### What happens after user actions

Users can take three actions on any inbox item (not just parsed ones):

- **Promote** — calls `POST /v1/inbox/{id}/promote`, creates a task, marks item as `promoted`
- **Edit** — opens a form pre-populated with parsed fields (or raw_text if unparsed), user modifies, then promotes with custom values
- **Reject** — calls `PATCH /v1/inbox/{id}` with `{"status": "rejected"}`

Agents do not need to handle these — the UI manages them. But agents should be aware that items may be promoted or rejected at any time.

### Confidence Model

| Level | Threshold | Behavior |
|-------|-----------|----------|
| High | >= 0.8 | Safe to auto-promote; UI shows "Added from Inbox" feedback |
| Medium | 0.4 - 0.8 | Requires user confirmation (default behavior) |
| Low | < 0.4 | Requires clarification or present multiple options |

### Inbox State Machine

```
unprocessed → processing → parsed → promoted
                        ↘ error      ↘ rejected
```

- `unprocessed` — raw capture, no agent has touched it
- `processing` — agent is actively parsing (UI shows spinner)
- `parsed` — structured proposal exists, awaiting user review
- `promoted` — became a task (terminal state)
- `rejected` — user discarded it (terminal state)
- `error` — parsing failed (user can still Edit/Promote manually)

### Inbox API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/inbox` | List items (optional `?status=` filter) |
| `GET` | `/v1/inbox/:id` | Get single item |
| `POST` | `/v1/inbox` | Capture new item (`raw_text` required, optional `source`, `domain_id`) |
| `PATCH` | `/v1/inbox/:id` | Update item — status, parsed fields, error |
| `POST` | `/v1/inbox/:id/promote` | Promote to task — accepts field overrides, creates task atomically |
| `DELETE` | `/v1/inbox/:id` | Delete item |

### Example Session

```
# 1. Check inbox at session start
GET /v1/inbox?status=unprocessed
→ [{"id": "inbox_abc", "raw_text": "fix dbt bug", "status": "unprocessed"}]

# 2. Mark as processing
PATCH /v1/inbox/inbox_abc
{"status": "processing"}

# 3. Interpret and propose
PATCH /v1/inbox/inbox_abc
{
  "status": "parsed",
  "parsed_title": "Fix mature_stores_weekly_count pipeline bug",
  "parsed_next_action": "Identify root cause of left-censoring logic in dbt model",
  "parsed_project": "Data Platform",
  "parsed_confidence": "0.75"
}

# 4. User sees proposal in UI, clicks Promote (or Edit → Promote)
# Task is created automatically. Agent can now find it via GET /v1/tasks.
```

### Success Criteria

- User recognizes their intent in the proposed task
- Minimal editing required before promotion
- System feels helpful, not intrusive
- All agent behavior is visible — no silent task creation

---

## Full API Reference

### Base URL

All endpoints are prefixed with `/v1`.

### Authentication

- `POST /auth/setup` and `GET /health` are public (no auth required).
- All other endpoints require `Authorization: Bearer <key>`.

### Error Response Format

```json
{"error": "message describing the problem"}
```

Common HTTP status codes:
- `200` — success
- `201` — created
- `400` — bad request
- `401` — unauthorized
- `404` — not found
- `409` — conflict (e.g., item already claimed)

---

### Health

#### GET /v1/health

No auth required.

Response (200): `{"status": "ok"}`

---

### Auth

#### POST /v1/auth/setup

First-run only: creates the initial API key. Returns 409 if any key already exists.

```
POST /v1/auth/setup
Content-Type: application/json

{"name": "my-key"}
```

Response (201):
```json
{"id": "key_abc123", "api_key": "tfa_sk_k_abc123...", "name": "my-key"}
```

Save `api_key` immediately — it is shown only once.

#### POST /v1/auth/keys

Create an additional API key. Requires auth.

```json
{"name": "ci-bot", "agent_id": "claude-code"}
```

Response (201): key object with `api_key` (shown once).

#### GET /v1/auth/keys

List all API keys (values redacted). Requires auth.

#### DELETE /v1/auth/keys/:id

Revoke a key. Response (200): `{"success": true}`

---

### Domains

#### POST /v1/domains

```json
{"name": "backend", "default_guardrail": "autonomous"}
```

`default_guardrail` defaults to `"autonomous"` if omitted. Response (201): domain object.

#### GET /v1/domains

List all domains. Response (200): `{"domains": [...]}`

#### PATCH /v1/domains/:id

Update `name` or `default_guardrail`. Response (200): updated domain object.

#### DELETE /v1/domains/:id

Cascades to projects and tasks. Response (200): `{"deleted": true}`

---

### Projects

#### POST /v1/projects

```json
{"name": "API v2", "domain_id": "d_abc123", "description": "Rewrite of the public API"}
```

Response (201): project object.

#### GET /v1/projects

Optional filter: `?domain_id=d_abc123`. Response (200): `{"projects": [...]}`

#### GET /v1/projects/:id

Response (200): project object or 404.

#### PATCH /v1/projects/:id

Update `name` or `description`. Response (200): updated project object.

#### DELETE /v1/projects/:id

Response (200): `{"deleted": true}`

---

### Tasks (Work Items)

#### POST /v1/tasks

Create a work item. Requires auth.

```
POST /v1/tasks
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "title": "Fix connection pool race condition",
  "domain_id": "d_abc123",
  "created_by": "claude-code",
  "project_id": "p_xyz789",
  "assignee": "claude-code",
  "priority": "high",
  "guardrail": "approval_required",
  "dependencies": ["t_dep001"],
  "due_date": "2024-03-01T00:00:00.000Z",
  "tags": ["bug", "backend"],
  "metadata": {"github_issue": 42},
  "goal": "Eliminate race condition causing intermittent connection timeouts.",
  "outcome_definition": "Zero errors in load test at 500 concurrent connections. PR merged.",
  "current_state": "Not started.",
  "next_action": "Reproduce locally, identify lock gap.",
  "blockers": [],
  "confidence": "medium"
}
```

Fields:

| Field | Required | Default | Description |
|---|---|---|---|
| `title` | yes | — | Short label for the work item |
| `domain_id` | yes | — | Domain this item belongs to |
| `created_by` | yes | — | Agent or user ID who created it |
| `project_id` | no | null | Project grouping |
| `assignee` | no | null | Agent or user ID assigned to work on it |
| `priority` | no | `"medium"` | `low`, `medium`, `high`, `urgent` |
| `guardrail` | no | domain default | `autonomous`, `notify`, `approval_required` |
| `dependencies` | no | null | Array of task IDs this item depends on |
| `due_date` | no | null | ISO 8601 date string |
| `tags` | no | null | Array of strings |
| `metadata` | no | null | Arbitrary JSON object |
| `goal` | no | null | What this item aims to achieve |
| `outcome_definition` | no | null | What "done" looks like — measurable |
| `current_state` | no | null | Machine-readable summary of current state |
| `next_action` | no | null | What should happen next |
| `blockers` | no | `[]` | Active blockers (array of strings) |
| `confidence` | no | null | `low`, `medium`, `high` |
| `claimed_by` | no | null | Agent currently holding the claim |
| `claim_expires_at` | no | null | When the claim auto-expires (ISO 8601) |

Response (201): full task object.

#### GET /v1/tasks

List work items with optional filters. Requires auth.

| Parameter | Description |
|---|---|
| `assignee` | Filter by assignee ID |
| `status` | Filter by status |
| `domain_id` | Filter by domain |
| `project_id` | Filter by project |
| `guardrail` | Filter by guardrail level |
| `search` | Case-insensitive substring match on title |

Multiple filters can be combined: `?assignee=claude-code&status=pending`

Response (200): `{"tasks": [...]}`

#### GET /v1/tasks/:id

Get a single work item. Requires auth.

The response includes the full task object **plus** two embedded arrays:
- `context` — full event log in chronological order
- `artifacts` — all artifacts attached to this item

This is the primary endpoint for resuming work on an existing item.

Response (200): task object with `context` and `artifacts`, or 404.

#### PATCH /v1/tasks/:id

Update any task fields. Requires auth. All fields optional.

Include `_actor` and `_actor_type` to attribute auto-generated events correctly:
```json
{"_actor": "claude-code", "_actor_type": "agent"}
```

`_actor_type` values: `agent`, `human`, `system`

Status transitions that trigger automatic `state_transition` context entries:
- Any `status` change
- Any `guardrail` change

Fields that trigger automatic `handoff` context entries:
- Any `assignee` change
- Any `claimed_by` change

Response (200): updated task object.

#### DELETE /v1/tasks/:id

Delete a work item and all associated context and artifacts. Response (200): `{"deleted": true}`

---

### Claims

#### POST /v1/tasks/:id/claim

Claim a work item for exclusive execution. Requires auth.

```
POST /v1/tasks/t_task001/claim
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"agent_id": "claude-code", "duration_minutes": 60}
```

Fields:
- `agent_id` (required) — the agent claiming the item
- `duration_minutes` (optional, default 30) — how long the claim is valid

Returns 409 if the item is already claimed by a different agent and the claim has not expired:
```json
{"error": "Already claimed", "claimed_by": "other-agent", "claim_expires_at": "2024-01-01T01:00:00.000Z"}
```

Response (200): updated task object.

Auto-generates a `claim` context entry.

#### POST /v1/tasks/:id/release

Release a claim. Requires auth.

```
POST /v1/tasks/t_task001/release
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"agent_id": "claude-code"}
```

Clears `claimed_by` and `claim_expires_at`. Auto-generates a `release` context entry.

Response (200): updated task object.

---

### Artifacts

Artifacts are first-class outputs. Create one for every file, branch, commit, PR, patch, plan, or document produced during work.

#### POST /v1/tasks/:id/artifacts

Create an artifact attached to a work item. Requires auth.

```
POST /v1/tasks/t_task001/artifacts
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "type": "pull_request",
  "title": "Fix connection pool race condition",
  "uri": "https://github.com/org/repo/pull/123",
  "created_by": "claude-code",
  "metadata": {"pr_number": 123, "base_branch": "main"}
}
```

Fields:
- `type` (required) — artifact type (see below)
- `created_by` (required) — agent or user ID who created it
- `title` (optional) — human-readable label
- `uri` (optional) — URL or file path pointing to the artifact
- `body` (optional) — inline content (e.g., patch text, plan markdown)
- `metadata` (optional) — arbitrary JSON

Artifact types:
- `file` — a file on disk (use `uri` for path)
- `branch` — a git branch (use `uri` for branch name or URL)
- `commit` — a git commit (use `uri` for SHA or URL)
- `pull_request` — a PR or MR (use `uri` for URL)
- `patch` — a diff or patch (use `body` for content)
- `plan` — a written plan (use `body` for content)
- `doc` — a document (use `body` or `uri`)
- `terminal_output` — captured output (use `body` for content)

Auto-generates an `artifact_created` context entry.

Response (201): artifact object.

#### GET /v1/tasks/:id/artifacts

List all artifacts for a work item in chronological order. Requires auth.

Response (200): `{"artifacts": [...]}`

#### GET /v1/artifacts/:id

Get a single artifact by ID. Requires auth.

Response (200): artifact object or 404.

Artifact object shape:
```json
{
  "id": "art_abc123",
  "task_id": "t_task001",
  "type": "pull_request",
  "title": "Fix connection pool race condition",
  "uri": "https://github.com/org/repo/pull/123",
  "body": null,
  "created_by": "claude-code",
  "metadata": {"pr_number": 123},
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Context

The context log is the persistent event stream for a work item. It is append-only and accumulates chronologically. The system auto-appends entries on state transitions, claims, releases, assignee changes, guardrail changes, and artifact creation.

#### POST /v1/tasks/:id/context

Append a context entry. Requires auth.

```
POST /v1/tasks/t_task001/context
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "type": "decision",
  "body": "Chose mutex approach over channel solution: simpler, no goroutine lifecycle changes needed.",
  "author": "claude-code",
  "actor_type": "agent"
}
```

Fields:
- `type` (required) — entry type (see below)
- `body` (required) — content of the entry
- `author` (required) — agent or user ID writing the entry
- `actor_type` (optional, default `"agent"`) — `agent`, `human`, or `system`

Context entry types:

| Type | When to use |
|---|---|
| `observation` | Something discovered during investigation |
| `action_taken` | An action performed (file edited, command run, API called) |
| `decision` | A choice made and the reasoning behind it |
| `blocker` | Something preventing progress; include what is needed to unblock |
| `state_transition` | Status or guardrail change (auto-generated by system) |
| `handoff` | Assignee or claim change (auto-generated by system) |
| `proposal` | A proposed approach or solution, pending review |
| `approval_requested` | Approval sought from a human before proceeding |
| `approval_received` | Approval received; include who approved and what was approved |
| `artifact_created` | An artifact was created (auto-generated by system) |
| `claim` | A claim was made (auto-generated by system) |
| `release` | A claim was released (auto-generated by system) |

Response (201): context entry object.

#### GET /v1/tasks/:id/context

Get all context entries in chronological order. Requires auth.

Response (200):
```json
{
  "context": [
    {
      "id": "ctx_abc123",
      "task_id": "t_task001",
      "type": "observation",
      "body": "Race condition in pool.ts:47 — two goroutines acquire without lock.",
      "author": "claude-code",
      "actor_type": "agent",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Agents

#### POST /v1/agents

Register an agent. The agent supplies its own ID. Requires auth.

```json
{
  "id": "claude-code",
  "name": "Claude Code",
  "type": "coding-agent",
  "capabilities": ["code-generation", "debugging", "code-review"]
}
```

Fields:
- `id` (required) — unique, stable identifier
- `name` (required) — human-readable display name
- `type` (optional, default `"generic"`) — agent type label
- `capabilities` (optional) — JSON array or object

Response (201): agent object.

#### GET /v1/agents

List all registered agents. `last_seen` is updated on every authenticated request linked to that agent. Requires auth.

Response (200): `{"agents": [...]}`

#### GET /v1/agents/:id

Get a single agent. Response (200): agent object or 404.

#### PATCH /v1/agents/:id

Update `name`, `type`, or `capabilities`. Response (200): updated agent object.

---

### Config

Config is a key-value store for preferences and operational settings. Values are arbitrary JSON.

#### POST /v1/config

Create or update (upsert). Requires auth.

```json
{"key": "onboarding_complete", "value": true}
```

Response (201): config entry object.

#### GET /v1/config

List all config entries. Response (200): `{"config": [...]}`

#### GET /v1/config/:key

Get a single entry. Response (200): config entry or 404.

#### PATCH /v1/config/:key

Update an existing entry. Response (200): updated config entry.

---

### Standard Config Keys

| Key | Type | Description |
|---|---|---|
| `onboarding_complete` | boolean | Whether the onboarding flow has been completed |
| `approval_behavior` | string | `ask_immediately`, `collect_and_summarize`, or `end_of_session` |
| `default_agent_id` | string | The primary agent ID for this installation |
| `timezone` | string | Timezone for the installation, e.g. `"America/New_York"` |

---

## Notes for Agents

- Task IDs: `t_` prefix. Domain IDs: `d_`. Project IDs: `p_`. Context IDs: `ctx_`. Artifact IDs: `art_`. API key IDs: `key_`. Agent IDs are free-form.
- All timestamps are ISO 8601 in UTC.
- `GET /v1/tasks/:id` returns the full task with embedded `context` and `artifacts` arrays — use this instead of three separate calls when resuming work.
- The context log is append-only. Use it as persistent working memory across sessions and agents.
- `last_seen` on agents is automatically updated on every authenticated request using a key linked to that agent.
- System-generated context entries (state transitions, claims, handoffs, artifact creation) use `actor_type: "system"`. Agent-authored entries should use `actor_type: "agent"`. Human entries use `actor_type: "human"`.
- Always set `goal`, `current_state`, `next_action`, and `outcome_definition` on work items. These fields are what make multi-agent handoff possible without out-of-band communication.
- Claims expire automatically. If `claim_expires_at` is in the past and `claimed_by` is set, the claim is expired and another agent may claim the item.
