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

After downloading, verify the MCP server is configured by checking if `threadron` appears in the output of:

```bash
claude mcp list 2>/dev/null | grep -i threadron
```

If the MCP server is NOT configured, tell the user:

> Threadron skill updated, but the MCP server is not configured. To connect:
>
> 1. Get an API key at [threadron.com/dashboard](https://threadron.com/dashboard/)
> 2. Run:
>    ```bash
>    claude mcp add --transport http threadron \
>      https://threadron.com/mcp \
>      -- --header "Authorization:Bearer YOUR_API_KEY"
>    ```
> 3. Restart Claude Code

If the MCP server IS configured, tell the user: "Threadron skill updated. Restart Claude Code for changes to take effect."
