# AgentTask (tasksforagents.com) — Design Spec

## Overview

A task management system designed for AI agent interfacing. Agents are the primary operators; humans supervise via a web dashboard with override authority. Think OmniFocus/Things, but built for personal AI assistants (Claude Code, OpenClaw, Hermes, and custom agents).

**Core thesis:** Your AI assistants need a persistent, structured place to track work across every domain of your life — and you need a single board to see it all.

## Product Model

- **Managed service** (primary) — Hosted SaaS at tasksforagents.com. Users sign up, get an API key, connect their agents. Revenue via subscription ($12/mo).
- **Self-hosted / community edition** — Open-source core. Docker Compose stack (API server + PostgreSQL + web dashboard). Free forever. Full feature parity with the core API.

The managed service differentiator is the **Smart Layer** (see Architecture).

---

## Architecture: Thin Core, Smart Layer

A layered architecture with a clean separation between the dumb-but-reliable core and the optional intelligence layer.

### Layer 1: Data Layer
- **PostgreSQL** — Single database for all task data.
- Managed service: hosted Postgres with automatic backups, high availability.
- Self-hosted: Postgres in a Docker container with a volume mount.

### Layer 2: Core API (Free / Self-hostable)
- Stateless REST API server.
- Pure CRUD operations — no LLM calls, no inference.
- Handles: tasks, projects, domains, context logs, agent registry, auth/API keys, guardrail configuration.
- Horizontally scalable (stateless).
- **This is the open-source heart of the system.**

### Layer 3: Smart Layer (Paid Tier / Managed Service Only)
- LLM-powered coordination layer.
- Consumes the **same REST API** as agents — it's just a privileged consumer.
- Capabilities:
  - **Deduplication** — Detects overlapping tasks across agents.
  - **Priority scoring** — Suggests priority ordering based on deadlines, dependencies, context.
  - **Scheduling** — Recommends when tasks should be worked on.
  - **Conflict detection** — Flags when two agents are working on overlapping goals.
  - **Context summarization** — Distills long context logs into actionable summaries.
- Uses the customer's managed service LLM token allocation.
- Not available for self-hosted (users' own agents provide intelligence in that case).

### Layer 4: Agent Layer
- Agents connect via pull-based REST API.
- Each agent has a registered identity (name, capabilities, activity history).
- Agents poll for tasks on their own schedule (`GET /v1/tasks?assignee={agent_id}&status=pending`).
- Each API key is scoped to a specific agent identity. The system resolves which agent is calling from the key.
- **Pull-based only** — no webhooks, no WebSocket, no persistent connections.
  - Rationale: Universal compatibility. Claude Code is a CLI that spins up/down. OpenClaw and Hermes have different runtime models. HTTP GET is the only thing every agent runtime can reliably do.
  - SSE/WebSocket can be added later as an optimization for agents that support it.

### Layer 5: Human Interface
- **Web dashboard** (primary) — Kanban/list view. Filters by domain, project, agent, status. Override controls. Task creation. Guardrail management.
- **CLI** (future) — Convenience layer hitting the same API. For developer users.
- **Mobile PWA** (future) — On-the-go oversight.

---

## Data Model

### Domains
- Top-level life areas: Personal, Work, Side Job, etc.
- Fixed set per user (rarely changes).
- Controls default guardrail levels and visibility scoping.
- A domain like "Work" might default to "approval required"; "Personal" might default to "autonomous."

### Projects
- Groups of related tasks within a domain.
- Examples: "Kitchen renovation" (Personal), "Q3 launch" (Work), "agentask MVP" (Side Job).
- Created by humans or agents.
- Optional — tasks can exist at the domain level without a project.

### Tasks
- The atomic unit.
- Fields:
  - `id` — Unique identifier (prefixed, e.g., `t_83f`).
  - `title` — Human-readable description.
  - `status` — `pending`, `in_progress`, `completed`, `blocked`, `cancelled`.
  - `domain` — Reference to parent domain.
  - `project` — Optional reference to parent project.
  - `assignee` — Agent ID or `user` for human-owned tasks.
  - `created_by` — Agent ID or `user` (provenance tracking).
  - `priority` — `low`, `medium`, `high`, `urgent`.
  - `guardrail` — `autonomous`, `notify`, `approval_required`.
  - `dependencies` — List of task IDs this task is blocked by.
  - `due_date` — Optional deadline.
  - `tags` — Freeform labels for cross-cutting categorization.
  - `metadata` — Arbitrary JSON for domain-specific data (e.g., Jira ticket ID, PR number).
  - `created_at`, `updated_at` — Timestamps.

### Context (Task Context Log)
- Structured, appendable, timestamped entries attached to a task.
- **This is the killer feature** — persistent memory scoped to a specific goal.
- Entry fields:
  - `id` — Unique identifier.
  - `task_id` — Parent task.
  - `type` — `observation`, `decision`, `blocker`, `progress`, `artifact`.
  - `body` — Free text content.
  - `author` — Agent ID or `user`.
  - `created_at` — Timestamp.
- Agents append context as they work. Any agent picking up a task later gets the full history.
- Solves the core problem: agents currently lose context between sessions.

### Agents (Agent Registry)
- Registered identities for each agent.
- Fields:
  - `id` — Unique identifier (e.g., `claude-code`, `hermes`).
  - `name` — Display name.
  - `type` — Agent platform (claude-code, openclaw, hermes, custom).
  - `last_seen` — Last API call timestamp (for monitoring).
  - `capabilities` — Freeform description of what this agent can do.
  - `created_at` — Registration timestamp.

### Guardrails Configuration
- Per-task autonomy controls, with domain-level defaults.
- Three levels:
  - `autonomous` — Agent acts freely. Human sees results on the board after the fact.
  - `notify` — Agent acts, task is flagged for human review on the dashboard (no push notification in v1 — human sees it next time they check the board).
  - `approval_required` — Agent proposes action, waits for human approval before proceeding.
- Configured during onboarding (via skill.md / agent setup) based on user preferences.
- Adjustable per-task, per-project, or per-domain at any time.

---

## API Design

### Authentication
- API key-based auth (`Authorization: Bearer tfa_sk_...`).
- One user can have multiple API keys (one per agent, one for the dashboard).
- Managed service: keys generated in the dashboard under Settings > API.
- Self-hosted: keys generated via `POST /v1/auth/setup` on first run, then `POST /v1/auth/keys` thereafter.

### Core Endpoints

```
# Tasks
POST   /v1/tasks                    — Create a task
GET    /v1/tasks                    — List tasks (filterable by domain, project, assignee, status, priority)
GET    /v1/tasks/{id}               — Get task with full context log
PATCH  /v1/tasks/{id}               — Update task (status, priority, assignee, etc.)
DELETE /v1/tasks/{id}               — Delete task

# Context
POST   /v1/tasks/{id}/context       — Append context entry
GET    /v1/tasks/{id}/context       — List context entries

# Projects
POST   /v1/projects                 — Create project
GET    /v1/projects                 — List projects (filterable by domain)
GET    /v1/projects/{id}            — Get project with task summary
PATCH  /v1/projects/{id}            — Update project
DELETE /v1/projects/{id}            — Delete project

# Domains
POST   /v1/domains                  — Create domain
GET    /v1/domains                  — List domains
PATCH  /v1/domains/{id}             — Update domain (name, default guardrail)
DELETE /v1/domains/{id}             — Delete domain

# Agents
POST   /v1/agents                   — Register agent
GET    /v1/agents                   — List registered agents
GET    /v1/agents/{id}              — Get agent details + activity
PATCH  /v1/agents/{id}              — Update agent

# Config (user preferences, persists across agents)
POST   /v1/config                   — Set config key-value pair
GET    /v1/config                   — Get all config
GET    /v1/config/{key}             — Get specific config value
PATCH  /v1/config/{key}             — Update config value

# Auth
POST   /v1/auth/setup               — Initial setup (first run only)
POST   /v1/auth/keys                — Create new API key
GET    /v1/auth/keys                — List API keys
DELETE /v1/auth/keys/{id}           — Revoke API key

# Health
GET    /v1/health                   — System health check
```

#### Task List Query Parameters
```
GET /v1/tasks?assignee=claude-code&status=pending     — Filter by assignee and status
GET /v1/tasks?domain=work&project=api-v2              — Filter by domain and project
GET /v1/tasks?search=deploy+staging                   — Full-text search (for dedup checks)
GET /v1/tasks?guardrail=approval_required&status=pending — Find tasks awaiting approval
```

### Agent Pull Loop
The standard agent interaction pattern:
1. `GET /v1/tasks?assignee={agent_id}&status=pending` — Check for work.
2. `PATCH /v1/tasks/{id}` with `{"status": "in_progress"}` — Claim a task.
3. `POST /v1/tasks/{id}/context` — Add observations, decisions, progress as you work.
4. `PATCH /v1/tasks/{id}` with `{"status": "completed"}` — Mark done.
5. Repeat.

---

## Integrations: Agent-Mediated

The system has **no built-in connectors**. Agents are the integration layer.

- To sync Jira: tell your agent "watch my Jira board" — it polls Jira and creates/updates tasks.
- To sync GitHub: agent watches issues/PRs and reflects them as tasks.
- To sync Calendar: agent reads your calendar and creates reminder tasks.

**Why:** Keeps the core simple. No OAuth token management, no webhook infrastructure, no dealing with third-party API changes. The system stays a clean task store. Agents evolve faster than platform connectors.

**How to make it easy:** Ship agent templates / pre-built skill.md configs for common integrations (Jira, GitHub, Slack, Google Calendar). Users copy-paste and configure.

**Monitoring:** Agents register as watchers. The system can surface "your Jira agent hasn't checked in for 2 hours" as a dashboard notification.

---

## Self-Hosted Architecture

Docker Compose stack with three containers:

1. **tasksforagents-api** (:8080) — Stateless REST API server. Horizontally scalable.
2. **tasksforagents-web** (:3000) — Static web dashboard frontend. No server-side rendering.
3. **tasksforagents-db** (:5432) — PostgreSQL. Data persisted to Docker volume.

No Redis, no message queue, no Kubernetes required. Add a reverse proxy (nginx, Caddy, Traefik) for TLS and it's production-ready.

**Selling point for managed:** "Your tasks survive your machine, travel with your agents, and are always accessible from any device." Self-hosted Docker DB is tied to one machine and can't easily move.

---

## Self-Hosted Network Accessibility

The Docker Compose stack must be accessible to agents running on the same machine or network.

- **Default binding:** API server binds to `0.0.0.0:8080` (not `127.0.0.1`) so agents running in other containers, other terminals, or other machines on the LAN can reach it.
- **Environment variable:** `TFA_API_URL` configurable in `.env` (defaults to `http://localhost:8080`). Agents use this to find the API.
- **Docker network:** All three containers on a shared Docker bridge network (`tasksforagents-net`). API server resolves the DB container by hostname.
- **Health check endpoint:** `GET /v1/health` returns `200` with `{"status": "ok"}`. Agents can verify connectivity before operating.
- **CORS:** Permissive by default for local development. Web dashboard served from `:3000` needs to reach API at `:8080`.

---

## skill.md — Agent Instruction File

The `skill.md` is the primary way agents learn how to use the system. It ships with the project and is designed to be dropped into any agent's configuration (Claude Code's `.claude/` directory, OpenClaw's prompt config, Hermes's instruction file, etc.).

### What skill.md Contains

1. **Full API documentation** — Every endpoint, request/response format, authentication, error codes. An agent reading this file should be able to use the entire API without any other reference.

2. **Onboarding flow** — Step-by-step instructions the agent follows on first connection:
   - Check if the system has been initialized (`GET /v1/health` + `GET /v1/domains`).
   - If no domains exist, run onboarding:
     - Ask the user what life domains they want (Personal, Work, Side Job, etc.).
     - Ask the user what guardrail level per domain (autonomous / notify / approval_required).
     - Ask what external sources to watch (Jira, GitHub, Calendar, etc.).
     - Ask about notification preferences (how often to surface "needs approval" items).
     - Create domains and set guardrail defaults via the API.
     - Store preferences in a system-level config via `POST /v1/config` (a key-value store for user preferences).
   - If domains exist, skip onboarding — the system is already configured.

3. **Ways of working** — Behavioral instructions for day-to-day operation:
   - On session start: poll for pending tasks assigned to you.
   - When working on a task: update status to `in_progress`, append context entries as you go.
   - When done: mark `completed`, add a final context summary.
   - When creating new tasks: check for duplicates first (`GET /v1/tasks?search=...`).
   - When a task has `guardrail: approval_required`: present the plan to the user, wait for approval, then proceed.
   - Always add provenance: who created it, why, what source it came from.
   - Respect domain guardrail defaults when creating tasks.

4. **Re-onboarding** — Instructions for when the user wants to change preferences:
   - User says "redo onboarding" or "change my preferences" or similar.
   - Agent re-runs the onboarding flow, updating domains and guardrails via the API.
   - Existing tasks are not affected — only defaults for future tasks change.

### How Preferences Persist Across Agents

Preferences are stored **in the system, not in the agent**. When any agent connects:
1. It reads `GET /v1/config` to get the user's preferences (guardrail defaults, domain list, notification preferences).
2. It reads `GET /v1/domains` and `GET /v1/agents` to understand the current state.
3. It follows the ways-of-working instructions from skill.md, parameterized by the config it just read.

This means a new agent connecting for the first time already knows everything — domains, guardrails, preferences — because it reads them from the API. No per-agent configuration needed beyond the API key and skill.md.

### Config Endpoint (Added)

```
POST   /v1/config                   — Set config key-value pair
GET    /v1/config                   — Get all config
GET    /v1/config/{key}             — Get specific config value
PATCH  /v1/config/{key}             — Update config value
```

Config stores: domain guardrail defaults, notification preferences, onboarding completion flag, watched external sources, and any other user preferences that agents need to know about.

---

## Onboarding Flow (Detailed)

The onboarding is agent-driven but human-approved. It runs once on first connection (or on demand).

### First-Time Setup

1. Agent reads skill.md and connects to the API.
2. `GET /v1/health` — verify the system is running.
3. `GET /v1/config/onboarding_complete` — check if onboarding has been done.
4. If not onboarded, agent asks the user (one question at a time):

   **Q1: "What areas of your life should I help manage?"**
   Suggestions: Personal, Work, Side Project — but accept any custom domains.
   → Creates domains via `POST /v1/domains` for each.

   **Q2: "For each domain, how much autonomy should agents have by default?"**
   Options per domain: autonomous / notify / approval_required.
   Example: "Personal: autonomous, Work: approval_required, Side Project: autonomous"
   → Updates domain guardrail defaults via `PATCH /v1/domains/{id}`.

   **Q3: "Are there external sources you'd like me to watch?"**
   Examples: "My Jira board at [URL]", "GitHub issues on [repo]", "Google Calendar"
   → Stores as config via `POST /v1/config` with key `watched_sources`.

   **Q4: "How should I handle tasks that need your approval?"**
   Options: "Ask me immediately" / "Collect them and show me a summary when I check in" / "Add to dashboard only"
   → Stores as config key `approval_behavior`.

5. `POST /v1/config` with `onboarding_complete: true`.
6. Agent confirms setup is done, shows a summary.

### Re-Onboarding

Triggered when the user says "redo onboarding", "change preferences", "update domains", or similar.

1. Agent reads current config and domains.
2. Presents current settings and asks what the user wants to change.
3. Updates via the API. Does NOT delete existing tasks or context.
4. Updates `onboarding_updated_at` timestamp in config.

---

## Marketing Site (Built)

5-page static site at `site/` with glitch+art, black-and-white aesthetic:

1. **Home** (index.html) — Manifesto hero, value prop, three pillars, API example, marquee.
2. **The System** (system.html) — Architecture flow, data model, pull loop code.
3. **Use Cases** (use-cases.html) — Dev, personal, side project, cross-domain board mockup.
4. **Get Started** (get-started.html) — Pricing, quickstart, waitlist.
5. **Open Source** (open-source.html) — Docker setup, container architecture, comparison table.

3 Minimax-generated hero images (glitch art, monochrome) integrated into pages 1-3.

---

## Tech Stack (Recommended)

- **API server:** Go or Node.js (TypeScript). Go preferred for simplicity and single-binary Docker image.
- **Database:** PostgreSQL.
- **Web dashboard:** React or Next.js. Static export for self-hosted simplicity.
- **Smart Layer:** Python or TypeScript service calling LLM APIs (Anthropic Claude).
- **Containerization:** Docker + Docker Compose.
- **Managed service hosting:** Fly.io, Railway, or AWS (ECS/RDS).

---

## Success Criteria

1. An agent (Claude Code, OpenClaw, or Hermes) can create a task, add context, and complete it via the REST API.
2. A human can see all tasks on the web dashboard, filtered by domain/project/agent.
3. A human can create a task from the dashboard and assign it to an agent.
4. Context persists across agent sessions — an agent picks up a task and has full history.
5. Multiple agents can operate on the same board without conflicts.
6. Self-hosted version runs with a single `docker compose up -d`.
7. Managed service handles auth, hosting, backups, and the Smart Layer.

---

## Out of Scope (v1)

- Real-time push notifications (WebSocket/SSE) — pull-only for v1.
- Multi-user / team support — single user with multiple agents for v1.
- Mobile app — web dashboard only for v1.
- CLI tool — API + web for v1.
- Built-in integrations — agent-mediated only.
- Smart Layer for self-hosted — managed service only.
- Billing / payment processing — waitlist + manual onboarding for early access.
