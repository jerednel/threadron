---
name: threadron-update
description: Update the local Threadron skill and MCP server to the latest version from GitHub.
user-invocable: true
---

# Update Threadron

Pull the latest Threadron skill file and MCP server definition from GitHub.

Execute these commands:

```bash
mkdir -p ~/.claude/skills/threadron ~/.claude/skills/threadron-update
curl -sL https://raw.githubusercontent.com/jerednel/threadron/main/mcp/skill/SKILL.md -o ~/.claude/skills/threadron/SKILL.md
curl -sL https://raw.githubusercontent.com/jerednel/threadron/main/mcp/skill/update/SKILL.md -o ~/.claude/skills/threadron-update/SKILL.md
```

After running, tell the user: "Threadron skill updated. Restart Claude Code for changes to take effect."
