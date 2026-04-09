---
name: threadron
description: Track work across sessions using Threadron shared execution state. Automatically checks in at session start, updates state as you work, and records artifacts.
---

# Threadron — Shared Execution State

You have access to Threadron tools for tracking work across sessions. Use them to maintain continuity — so the next session (yours or another agent's) knows exactly where things stand.

## CRITICAL RULE

**Every time you change what you're doing, call BOTH:**
1. `threadron_update_state` — to update the structured fields (current_state, next_action, blockers)
2. `threadron_add_context` — to explain WHY in the timeline (what you observed, decided, or did)

State fields tell the next reader WHAT. Context entries tell them WHY. Both are required. A state update without a context entry leaves the timeline empty and makes the work item history useless.

## Session Start

At the **start of every session**, call `threadron_checkin` to see:
- Work items you left in progress (resume these first)
- Pending items assigned to you
- Blocked items that need attention

If there's in-progress work, call `threadron_get_task` on it to read the full state (goal, current_state, next_action, blockers, timeline, artifacts) before doing anything else.

## While Working

When you're actively working on a Threadron work item, follow this pattern at EVERY meaningful step:

### The Update Pattern (use this every time something changes)

```
1. threadron_add_context  → log what happened (observation, decision, action_taken)
2. threadron_update_state → update current_state and next_action
```

Always log context FIRST, then update state. This ensures the timeline explains every state change.

### Examples of when to use this pattern:

- You investigate something → `add_context(type: "observation", body: "Found X")` → `update_state(current_state: "Investigated, found X")`
- You make a choice → `add_context(type: "decision", body: "Going with approach A because...")` → `update_state(next_action: "Implement approach A")`
- You complete a step → `add_context(type: "action_taken", body: "Deployed to staging")` → `update_state(current_state: "Deployed to staging", next_action: "Run smoke tests")`
- You hit a wall → `add_context(type: "blocker", body: "Need API key for service X")` → `update_state(blockers: ["Need API key for service X"])`

### Starting work

1. **Claim it** — `threadron_claim` before starting (prevents other agents from colliding)
2. **Update status** — `threadron_update_state(status: "in_progress")`

### Producing outputs

- `threadron_create_artifact` for branches, PRs, files, plans, terminal output
- Always pair with `threadron_add_context(type: "action_taken", body: "Created branch X")`

## Session End / Pausing

Before the session ends or when switching to other work:

1. `threadron_add_context(type: "action_taken", body: "Pausing. Summary of what was done...")` — summarize the session
2. `threadron_update_state` — set `current_state` and `next_action` to exactly what the next session needs to know
3. `threadron_release` — release the claim so other agents can pick it up
4. If done: `threadron_update_state(status: "completed")`

## Creating New Work

When you identify new work to be done:

1. `threadron_list_tasks` with `search` to check it doesn't already exist
2. `threadron_create_task` with at minimum: title, domain_id, goal, and outcome_definition
3. Set `current_state` and `next_action` if you know them

## Key Principle

**Write state for the next reader, not for yourself.** The whole point is that a different session — possibly a different agent — should be able to pick up any work item and immediately understand what's going on without re-investigating.

**The timeline IS the story.** If the timeline is empty, the work item is useless for handoff. Every state change needs a context entry explaining it.
