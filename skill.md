# AgentTask (TFA) — Complete Agent Guide

This file contains everything an agent needs to use the AgentTask API: configuration, onboarding, ways of working, and a full API reference with examples.

---

## Configuration

Set these environment variables before using this skill:

| Variable | Description | Example |
|---|---|---|
| `TFA_API_URL` | Base URL of the AgentTask API | `http://localhost:8080` |
| `TFA_API_KEY` | Bearer token for authentication | `tfa_sk_k_abc123...` |
| `TFA_AGENT_ID` | This agent's registered ID | `claude-code` |

All authenticated requests must include:
```
Authorization: Bearer $TFA_API_KEY
```

---

## Quick Start — Session Start Checklist

Run these checks at the start of every session:

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

3. **Pending tasks** — find work assigned to this agent:
   ```
   GET $TFA_API_URL/v1/tasks?assignee=$TFA_AGENT_ID&status=pending
   Authorization: Bearer $TFA_API_KEY
   ```

---

## Full Onboarding Flow

Run this flow when first setting up or when the user requests re-onboarding. Work through all 6 steps in order.

### Step 1 — Register this agent

Ask the user what name to use for this agent (or use the default agent ID).

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

### Step 2 — Ask about life/work domains, then create them

Ask the user: "What areas of your life or work should I help with? Common examples: Work, Personal, Health, Finance, Learning, Side Projects."

For each domain the user names, create it:

```
POST /v1/domains
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "name": "Work",
  "default_guardrail": "autonomous"
}
```

Response (201):
```json
{
  "id": "d_abc123",
  "name": "Work",
  "default_guardrail": "autonomous",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

Save the domain IDs for use in subsequent steps and task creation.

### Step 3 — Ask about guardrail levels per domain

Guardrail levels control how much autonomy the agent has:

| Level | Meaning |
|---|---|
| `autonomous` | Agent acts freely without asking for approval |
| `notify` | Agent acts and notifies the user after |
| `approval_required` | Agent must ask the user before acting |

Ask the user: "For each domain, what guardrail level would you prefer? For example, for 'Work' tasks related to production systems, you might want 'approval_required'."

Update each domain with the chosen guardrail:

```
PATCH /v1/domains/{domain_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "default_guardrail": "approval_required"
}
```

Response (200):
```json
{
  "id": "d_abc123",
  "name": "Work",
  "default_guardrail": "approval_required",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Step 4 — Ask about external sources to watch

Ask the user: "Are there any external sources I should monitor for new tasks? For example: GitHub issues, Jira boards, email inboxes, Slack channels, RSS feeds."

Store the answer in config:

```
POST /v1/config
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "key": "watched_sources",
  "value": ["github:owner/repo/issues", "slack:#dev-channel"]
}
```

Response (201):
```json
{
  "key": "watched_sources",
  "value": ["github:owner/repo/issues", "slack:#dev-channel"],
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

If the user has no external sources, store an empty array: `"value": []`

### Step 5 — Ask about approval behavior

Ask the user: "When I have tasks that need your approval, how would you like me to handle them? Options:
- `ask_immediately` — interrupt you right away
- `collect_and_summarize` — collect approvals and present them together at a natural break
- `end_of_session` — save all approvals until you ask for a summary"

Store the answer:

```
POST /v1/config
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "key": "approval_behavior",
  "value": "collect_and_summarize"
}
```

### Step 6 — Mark onboarding complete

```
POST /v1/config
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "key": "onboarding_complete",
  "value": true
}
```

Tell the user: "Setup complete. I'm ready to help manage your tasks."

---

## Ways of Working

### Session Start Routine

1. Run the Quick Start checklist (health, onboarding check, pending tasks).
2. If there are in-progress tasks from a previous session, resume by reading their context log.
3. Announce what you found: "You have X pending tasks. Currently working on: [task title]."

### Creating Tasks

Before creating a task, always search to avoid duplicates:

```
GET /v1/tasks?search=connection+pool
Authorization: Bearer $TFA_API_KEY
```

If no existing task matches, create one:

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
  "tags": ["bug", "backend", "database"],
  "metadata": {"source": "github-issue-42"}
}
```

### Working on Tasks

**Claim a task** (move to in_progress):
```
PATCH /v1/tasks/{task_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"status": "in_progress"}
```

**Read the context log** to understand prior work:
```
GET /v1/tasks/{task_id}/context
Authorization: Bearer $TFA_API_KEY
```

**Add context entries** as you work. Use these types:
- `observation` — something you noticed or discovered
- `decision` — a choice you made and why
- `artifact` — code, output, or file produced
- `blocker` — something preventing progress
- `note` — general note

```
POST /v1/tasks/{task_id}/context
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "type": "observation",
  "body": "The race condition occurs when two workers try to acquire a connection simultaneously under load.",
  "author": "claude-code"
}
```

**Complete a task**:
```
PATCH /v1/tasks/{task_id}
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"status": "completed"}
```

Other valid status values: `pending`, `in_progress`, `blocked`, `cancelled`, `completed`

### Guardrail Handling

Check a task's `guardrail` field before acting:

- `autonomous`: proceed without asking
- `notify`: proceed, then tell the user what you did
- `approval_required`: stop and ask the user before proceeding; add a `blocker` context entry explaining what needs approval; set status to `blocked`

If no guardrail is set on the task, fall back to the domain's `default_guardrail`.

### Respecting Other Agents

Before claiming a task, check if it already has an assignee:
```
GET /v1/tasks/{task_id}
Authorization: Bearer $TFA_API_KEY
```

If `assignee` is set to a different agent and status is `in_progress`, do not claim it. You may read its context log, but leave a note context entry instead of modifying the task.

List all registered agents to know who else is active:
```
GET /v1/agents
Authorization: Bearer $TFA_API_KEY
```

---

## Re-Onboarding

Triggered when the user says "redo onboarding", "change preferences", or "reset setup".

Steps:
1. Set `onboarding_complete` to `false`:
   ```
   POST /v1/config
   {"key": "onboarding_complete", "value": false}
   ```
2. Run the Full Onboarding Flow from Step 1.
3. Existing tasks and context are preserved — only preferences change.

---

## Full API Reference

### Base URL

All endpoints are prefixed with `/v1`.

### Authentication

- `POST /auth/setup` and `GET /health` are public (no auth required).
- All other endpoints require `Authorization: Bearer <key>`.

### Error Response Format

All errors return JSON:
```json
{"error": "message describing the problem"}
```

Common HTTP status codes:
- `200` — success
- `201` — created
- `400` — bad request (invalid body)
- `401` — unauthorized (missing or invalid API key)
- `404` — not found
- `409` — conflict (e.g., setup already done)

---

### Health

#### GET /v1/health

Check API availability. No auth required.

Request:
```
GET /v1/health
```

Response (200):
```json
{"status": "ok"}
```

---

### Auth

#### POST /v1/auth/setup

First-run only: creates the initial API key. Returns 409 if any key already exists.

Request:
```
POST /v1/auth/setup
Content-Type: application/json

{"name": "my-key"}
```

Response (201):
```json
{
  "id": "key_abc123",
  "api_key": "tfa_sk_k_abc123...",
  "name": "my-key"
}
```

Save `api_key` immediately — it is shown only once.

#### POST /v1/auth/keys

Create an additional API key. Requires auth.

Request:
```
POST /v1/auth/keys
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"name": "ci-bot", "agent_id": "claude-code"}
```

Response (201):
```json
{
  "id": "key_xyz789",
  "api_key": "tfa_sk_k_xyz789...",
  "name": "ci-bot",
  "agent_id": "claude-code"
}
```

#### GET /v1/auth/keys

List all API keys (key values are redacted). Requires auth.

Response (200):
```json
{
  "keys": [
    {
      "id": "key_abc123",
      "name": "my-key",
      "agent_id": null,
      "key_prefix": "tfa_sk_k_abc123...",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### DELETE /v1/auth/keys/:id

Revoke an API key. Requires auth.

Response (200):
```json
{"success": true}
```

---

### Domains

#### POST /v1/domains

Create a domain. Requires auth.

Request:
```
POST /v1/domains
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "name": "Work",
  "default_guardrail": "autonomous"
}
```

`default_guardrail` defaults to `"autonomous"` if omitted.

Response (201):
```json
{
  "id": "d_abc123",
  "name": "Work",
  "default_guardrail": "autonomous",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

#### GET /v1/domains

List all domains. Requires auth.

Response (200):
```json
{
  "domains": [
    {
      "id": "d_abc123",
      "name": "Work",
      "default_guardrail": "autonomous",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### PATCH /v1/domains/:id

Update a domain's name or guardrail. Requires auth.

Request:
```
PATCH /v1/domains/d_abc123
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"default_guardrail": "approval_required"}
```

Response (200): updated domain object.

#### DELETE /v1/domains/:id

Delete a domain (cascades to projects and tasks). Requires auth.

Response (200):
```json
{"deleted": true}
```

---

### Projects

#### POST /v1/projects

Create a project within a domain. Requires auth.

Request:
```
POST /v1/projects
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "name": "API v2",
  "domain_id": "d_abc123",
  "description": "Rewrite of the public API"
}
```

Response (201):
```json
{
  "id": "p_xyz789",
  "name": "API v2",
  "domain_id": "d_abc123",
  "description": "Rewrite of the public API",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

#### GET /v1/projects

List projects. Optional filter: `?domain_id=d_abc123`. Requires auth.

Response (200):
```json
{
  "projects": [
    {
      "id": "p_xyz789",
      "name": "API v2",
      "domain_id": "d_abc123",
      "description": "Rewrite of the public API",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET /v1/projects/:id

Get a single project. Requires auth.

Response (200): project object.

#### PATCH /v1/projects/:id

Update a project's name or description. Requires auth.

Request:
```
PATCH /v1/projects/p_xyz789
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"name": "API v3", "description": "Updated scope"}
```

Response (200): updated project object.

#### DELETE /v1/projects/:id

Delete a project. Requires auth.

Response (200):
```json
{"deleted": true}
```

---

### Tasks

#### POST /v1/tasks

Create a task. Requires auth.

Request:
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
  "metadata": {"github_issue": 42}
}
```

Fields:
- `title` (required) — task title
- `domain_id` (required) — domain this task belongs to
- `created_by` (required) — agent or user ID who created it
- `project_id` (optional) — project this task belongs to
- `assignee` (optional) — agent or user ID assigned to work on it
- `priority` (optional, default `"medium"`) — `low`, `medium`, `high`, `urgent`
- `guardrail` (optional) — overrides domain default; `autonomous`, `notify`, `approval_required`
- `dependencies` (optional) — array of task IDs this task depends on
- `due_date` (optional) — ISO 8601 date string
- `tags` (optional) — array of strings
- `metadata` (optional) — arbitrary JSON object

Response (201):
```json
{
  "id": "t_task001",
  "title": "Fix connection pool race condition",
  "status": "pending",
  "domain_id": "d_abc123",
  "project_id": "p_xyz789",
  "assignee": "claude-code",
  "created_by": "claude-code",
  "priority": "high",
  "guardrail": "approval_required",
  "dependencies": ["t_dep001"],
  "due_date": "2024-03-01T00:00:00.000Z",
  "tags": ["bug", "backend"],
  "metadata": {"github_issue": 42},
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

#### GET /v1/tasks

List tasks with optional filters. Requires auth.

Query parameters:
| Parameter | Description | Example |
|---|---|---|
| `assignee` | Filter by assignee ID | `?assignee=claude-code` |
| `status` | Filter by status | `?status=pending` |
| `domain_id` | Filter by domain | `?domain_id=d_abc123` |
| `project_id` | Filter by project | `?project_id=p_xyz789` |
| `guardrail` | Filter by guardrail level | `?guardrail=approval_required` |
| `search` | Case-insensitive title search | `?search=connection+pool` |

Multiple filters can be combined: `?assignee=claude-code&status=pending`

Response (200):
```json
{
  "tasks": [
    {
      "id": "t_task001",
      "title": "Fix connection pool race condition",
      "status": "pending",
      ...
    }
  ]
}
```

#### GET /v1/tasks/:id

Get a single task. Requires auth.

Response (200): task object or `{"error": "Not found"}` (404).

#### PATCH /v1/tasks/:id

Update a task. Requires auth. All fields optional.

Common status transitions:
- `pending` → `in_progress` (claim task)
- `in_progress` → `blocked` (waiting on something)
- `in_progress` → `completed` (done)
- `in_progress` → `cancelled` (abandoned)

Request:
```
PATCH /v1/tasks/t_task001
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"status": "in_progress"}
```

Response (200): updated task object.

#### DELETE /v1/tasks/:id

Delete a task. Requires auth.

Response (200):
```json
{"deleted": true}
```

---

### Context

Context entries are the persistent log for a task. They accumulate chronologically and are never deleted unless the task is deleted.

#### POST /v1/tasks/:id/context

Append a context entry. Requires auth.

Request:
```
POST /v1/tasks/t_task001/context
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "type": "observation",
  "body": "Found the race condition in pool.ts line 47 — two goroutines acquire without lock.",
  "author": "claude-code"
}
```

Entry types (convention, not enforced):
- `observation` — something discovered during investigation
- `decision` — a choice made and the reasoning behind it
- `artifact` — code snippet, diff, file path, or URL produced
- `blocker` — something preventing progress; include what is needed
- `note` — general notes or status updates

Response (201):
```json
{
  "id": "ctx_abc123",
  "task_id": "t_task001",
  "type": "observation",
  "body": "Found the race condition in pool.ts line 47...",
  "author": "claude-code",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

#### GET /v1/tasks/:id/context

Get all context entries for a task, in chronological order. Requires auth.

Response (200):
```json
{
  "context": [
    {
      "id": "ctx_abc123",
      "task_id": "t_task001",
      "type": "observation",
      "body": "Found the race condition...",
      "author": "claude-code",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Agents

#### POST /v1/agents

Register an agent. The agent supplies its own ID. Requires auth.

Request:
```
POST /v1/agents
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "id": "claude-code",
  "name": "Claude Code",
  "type": "coding-agent",
  "capabilities": ["code-generation", "debugging", "code-review"]
}
```

Fields:
- `id` (required) — unique agent identifier (choose something stable)
- `name` (required) — human-readable display name
- `type` (optional, default `"generic"`) — agent type label
- `capabilities` (optional) — JSON array or object describing abilities

Response (201): agent object.

#### GET /v1/agents

List all registered agents. Requires auth.

Response (200):
```json
{
  "agents": [
    {
      "id": "claude-code",
      "name": "Claude Code",
      "type": "coding-agent",
      "capabilities": ["code-generation", "debugging", "code-review"],
      "last_seen": "2024-01-01T12:00:00.000Z",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET /v1/agents/:id

Get a single agent. Requires auth.

Response (200): agent object or 404.

#### PATCH /v1/agents/:id

Update an agent. Requires auth.

Request:
```
PATCH /v1/agents/claude-code
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{
  "capabilities": ["code-generation", "debugging", "code-review", "test-writing"]
}
```

Response (200): updated agent object.

---

### Config

Config is a simple key-value store. Values are arbitrary JSON. Standard keys are listed below.

#### POST /v1/config

Create or update a config entry (upsert). Requires auth.

Request:
```
POST /v1/config
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"key": "onboarding_complete", "value": true}
```

Response (201):
```json
{
  "key": "onboarding_complete",
  "value": true,
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

#### GET /v1/config

List all config entries. Requires auth.

Response (200):
```json
{
  "config": [
    {"key": "onboarding_complete", "value": true, "updated_at": "2024-01-01T00:00:00.000Z"},
    {"key": "approval_behavior", "value": "collect_and_summarize", "updated_at": "2024-01-01T00:00:00.000Z"}
  ]
}
```

#### GET /v1/config/:key

Get a single config entry. Requires auth.

Response (200): config entry object or 404.

#### PATCH /v1/config/:key

Update an existing config entry. Requires auth.

Request:
```
PATCH /v1/config/approval_behavior
Authorization: Bearer $TFA_API_KEY
Content-Type: application/json

{"value": "ask_immediately"}
```

Response (200): updated config entry object.

---

### Standard Config Keys

| Key | Type | Description |
|---|---|---|
| `onboarding_complete` | boolean | Whether the onboarding flow has been completed |
| `approval_behavior` | string | How approval tasks are handled: `ask_immediately`, `collect_and_summarize`, `end_of_session` |
| `watched_sources` | array | External sources to monitor for new tasks |
| `default_agent_id` | string | The primary agent ID for this installation |
| `timezone` | string | User's timezone, e.g. `"America/New_York"` |

---

## Notes for Agents

- Task IDs start with `t_`, domain IDs with `d_`, project IDs with `p_`, agent IDs are free-form, context entry IDs start with `ctx_`, API key IDs start with `key_`.
- All timestamps are ISO 8601 in UTC.
- The `search` query parameter on `GET /v1/tasks` is case-insensitive substring match on the title.
- Config values are arbitrary JSON — booleans, strings, arrays, and objects are all valid.
- The context log for a task is append-only through the API. Use it as a persistent working memory across sessions.
- `last_seen` on an agent is automatically updated on every authenticated API request made with a key linked to that agent.
