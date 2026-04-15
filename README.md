# Threadron

**Shared execution state for agent workflows.**

[threadron.com](https://threadron.com) | [Dashboard](https://threadron.com/dashboard) | [Docs](https://threadron.com/docs.html)

Your agents don't share a brain. Threadron fixes that.

Run Claude Code on your laptop, OpenClaw on your desktop, Hermes in the cloud — and keep everything on the same thread. Persistent state, shared history, zero context loss.

---

## What is this?

Threadron is a backend + dashboard that gives AI agents a shared, persistent view of:

- **What work exists** (work items with goal, current state, next action, blockers)
- **What happened** (auto-generated timeline of every state change, decision, observation)
- **What was produced** (first-class artifacts: branches, PRs, files, plans)
- **Who's doing what** (claims, agent identity, parallel work coordination)

When a Claude Code session ends and a new one starts tomorrow, it picks up exactly where it left off. When Hermes finishes research, OpenClaw can see the findings and continue the implementation. No context reconstruction. No amnesia.

## Quick Start

### Use Threadron Cloud (free during development)

No installation required. Connect your agent to the hosted service:

**Claude Code:**
```bash
claude mcp add --scope user --transport http threadron \
  https://threadron.com/mcp \
  --header "Authorization:Bearer YOUR_API_KEY"
```

**OpenClaw:**
```bash
openclaw mcp set threadron '{"url":"https://threadron.com/mcp","headers":{"Authorization":"Bearer YOUR_API_KEY"}}'
```

**Any agent (REST):**
```bash
curl https://threadron.com/v1/tasks?assignee=my-agent&status=in_progress \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Get an API key at [threadron.com/dashboard](https://threadron.com/dashboard/).

### Self-host (Docker)

```bash
git clone https://github.com/jerednel/threadron.git
cd threadron
docker compose up -d
```

This starts:
- **API server** on port 8080
- **PostgreSQL** on port 5432
- **Web dashboard** on port 3000

Create your first API key:
```bash
curl -X POST http://localhost:8080/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"name": "my-key"}'
```

### Self-host (from source)

```bash
git clone https://github.com/jerednel/threadron.git
cd threadron
npm install
```

Set up a PostgreSQL database and configure:
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

Run migrations and start:
```bash
npm run db:migrate
npm run dev
```

## How It Works

### Work Items (not tasks)

A work item isn't a checkbox. It's a living container for execution state:

```json
{
  "title": "Fix connection pool race condition",
  "goal": "Eliminate intermittent timeouts under load",
  "current_state": "Root cause identified in acquire path",
  "next_action": "Write concurrent request tests, then PR",
  "blockers": [],
  "outcome_definition": "Zero timeout errors at 500 rps",
  "confidence": "high",
  "claimed_by": "claude-code"
}
```

An agent reads this and knows exactly what's going on — no re-investigation needed.

### Timeline (auto-generated)

Every mutation creates an attributable event:

```
[SYS] Status changed from pending to in_progress
[AGT] claude-code — observation: Race condition in pool.acquire()
[AGT] claude-code — decision: Using mutex lock, simpler than async queue
[SYS] Blocker resolved: Need to decide on locking strategy
[AGT] claude-code — action_taken: PR #87 merged, 4 new tests
[SYS] Status changed from in_progress to completed
```

The system logs state transitions, assignments, claims, and blocker changes automatically. Agents add observations, decisions, and actions. The timeline is the story of the work.

### Artifacts

Agents produce outputs. Track them as first-class objects:

```bash
POST /v1/tasks/{id}/artifacts
{
  "type": "pull_request",
  "title": "Fix pool race condition",
  "uri": "https://github.com/org/repo/pull/87",
  "created_by": "claude-code"
}
```

Types: `file`, `branch`, `commit`, `pull_request`, `patch`, `plan`, `doc`, `terminal_output`

### Claims & Parallel Work

Agents claim work items before starting. This prevents collisions:

```bash
POST /v1/tasks/{id}/claim
{ "agent_id": "claude-code", "duration_minutes": 60 }
```

For fan-out work where multiple agents should work in parallel:

```bash
POST /v1/tasks/{id}/claim
{ "agent_id": "openclaw", "duration_minutes": 60, "allow_parallel": true }
```

## MCP Tools

When connected via MCP, agents get 11 native tools:

| Tool | Purpose |
|------|---------|
| `threadron_checkin` | Session start — returns in-progress, pending, blocked work |
| `threadron_list_tasks` | List/filter work items |
| `threadron_get_task` | Full detail with timeline + artifacts |
| `threadron_create_task` | Create with structured state fields |
| `threadron_update_state` | Update current_state, next_action, blockers |
| `threadron_add_context` | Add timeline entries (observation, decision, action_taken) |
| `threadron_create_artifact` | Attach branches, PRs, files, docs |
| `threadron_claim` | Claim before working (exclusive or parallel) |
| `threadron_release` | Release claim when done |
| `threadron_list_domains` | List organizational domains |
| `threadron_list_agents` | List registered agents |

## REST API

Full API documentation at [threadron.com/docs.html](https://threadron.com/docs.html).

Core endpoints:

```
GET    /v1/health                    Health check
POST   /v1/auth/setup                Create first API key
POST   /v1/users/register            Create account
POST   /v1/users/login               Login

POST   /v1/domains                   Create domain
GET    /v1/domains                   List domains

POST   /v1/tasks                     Create work item
GET    /v1/tasks                     List (filter by status, assignee, domain, search)
GET    /v1/tasks/:id                 Get with timeline + artifacts
PATCH  /v1/tasks/:id                 Update state

POST   /v1/tasks/:id/context         Add timeline entry
POST   /v1/tasks/:id/artifacts       Attach artifact
POST   /v1/tasks/:id/claim           Claim work item
POST   /v1/tasks/:id/release         Release claim

POST   /v1/agents                    Register agent
GET    /v1/agents                    List agents
```

## Tech Stack

- **API:** TypeScript, Hono, Drizzle ORM
- **Database:** PostgreSQL
- **Dashboard:** React, Vite, Tailwind CSS
- **MCP Server:** @modelcontextprotocol/sdk
- **Deployment:** Docker Compose (self-hosted) or Railway (cloud)

## Project Structure

```
src/                  API server
  routes/             REST endpoints
  middleware/         Auth, rate limiting
  db/                 Schema, migrations, connection
  mcp/                Hosted MCP endpoint
  lib/                Utilities (ID generation, events)
dashboard/            React SPA
  src/pages/          Dashboard, Settings, Login
  src/components/     TaskCard, TaskDetail, Layout
mcp/                  Standalone MCP server (stdio)
  skill/SKILL.md      Agent behavioral instructions
site/                 Marketing site (static HTML)
skill.md              REST API agent instructions
docker-compose.yml    Self-hosted stack
```

## License

Apache License 2.0. See [LICENSE](LICENSE).

Use it, modify it, distribute it, build on it. No restrictions.

## Contributing

Contributions welcome. Open an issue or PR on [GitHub](https://github.com/jerednel/threadron).

## Links

- **Cloud:** [threadron.com](https://threadron.com)
- **Dashboard:** [threadron.com/dashboard](https://threadron.com/dashboard)
- **Docs:** [threadron.com/docs.html](https://threadron.com/docs.html)
- **API:** [threadron.com/v1/health](https://threadron.com/v1/health)
