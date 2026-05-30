# Market Notes

Snapshot: May 29, 2026.

## What The Market Is Saying

- Coding-agent adoption is now broad enough that teams are feeling downstream review and stability pressure, not just prototype excitement.
- The orchestration layer is crowded: Dispatch, Warp Oz, Orchestratia, Stoneforge, hashd, Bernstein, Watchfire, and workmux all point toward worktrees, task lanes, sandboxing, shared context, and multi-agent control.
- That crowding is useful. It validates the category, but it also means a pure dashboard has to fight many tools at once.

## Wedge Decision

Do not start with another orchestration SaaS.

Start with a productized implementation service:

> AgentOps Fieldkit installs the operating layer around the tools a team already uses.

The sales angle is the gap between adoption and operational maturity:

- more generated code
- more agent branches
- more review load
- more hidden coordination cost
- more uncertainty about what actually happened during a long run

## Position Against Tools

Tools sell control planes.

AgentOps Fieldkit sells the outcome:

- your first run receipt format
- your first worktree lane policy
- your first review gate checklist
- your first shared-state cleanup rule
- your first cost-routing rule
- your first handoff contract that engineers actually use

If a tool is already installed, Fieldkit makes it operational. If no tool is installed, Fieldkit starts with the lightest workflow that proves the habit before buying platform complexity.

## Sources Checked

- TechRadar, May 2026: AI coding speed is rising while teams report deployment and stability pressure.
- Warp Oz launch materials: cloud coding-agent orchestration is being sold as a standalone category.
- Dispatch, Stoneforge, hashd, Bernstein, Watchfire, workmux: current market pages showing worktree and multi-agent orchestration patterns.
- 2026 arXiv papers on coding-agent adoption and AI-generated code debt.
