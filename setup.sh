#!/bin/bash
# Threadron Setup — connects Claude Code to your Threadron instance
#
# Usage:
#   ./setup.sh <api-key> [api-url] [agent-id]
#
# Example:
#   ./setup.sh tfa_sk_k_abc123
#   ./setup.sh tfa_sk_k_abc123 https://api.tasksforagents.com/v1 my-agent

set -e

API_KEY="${1:?Usage: ./setup.sh <api-key> [api-url] [agent-id]}"
API_URL="${2:-https://threadron.com/v1}"
AGENT_ID="${3:-claude-code}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$SCRIPT_DIR/mcp"

echo "═══════════════════════════════════════"
echo "  Threadron Setup"
echo "═══════════════════════════════════════"
echo ""

# Step 1: Build MCP server
echo "→ Building MCP server..."
cd "$MCP_DIR"
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null
echo "  ✓ MCP server built"

# Step 2: Verify API connection
echo "→ Verifying API connection..."
HEALTH=$(curl -sf "$API_URL/health" 2>/dev/null || echo "FAIL")
if [ "$HEALTH" = "FAIL" ]; then
  echo "  ✗ Cannot reach $API_URL/health"
  echo "  Check your API URL and try again."
  exit 1
fi
echo "  ✓ API reachable"

# Step 3: Verify API key
echo "→ Verifying API key..."
DOMAINS=$(curl -sf -H "Authorization: Bearer $API_KEY" "$API_URL/domains" 2>/dev/null || echo "FAIL")
if [ "$DOMAINS" = "FAIL" ]; then
  echo "  ✗ API key invalid or unauthorized"
  exit 1
fi
echo "  ✓ API key valid"

# Step 4: Register MCP server with Claude Code (user scope = all projects)
echo "→ Registering Threadron MCP server with Claude Code..."
MCP_PATH="$MCP_DIR/dist/index.js"

claude mcp remove threadron 2>/dev/null || true
claude mcp add --scope user threadron \
  -e TFA_API_URL="$API_URL" \
  -e TFA_API_KEY="$API_KEY" \
  -e TFA_AGENT_ID="$AGENT_ID" \
  -- node "$MCP_PATH"

echo "  ✓ MCP server registered (user scope — available in all projects)"

# Step 5: Install the Threadron skill
echo "→ Installing Threadron skill..."
SKILL_DIR="$HOME/.claude/skills/threadron"
mkdir -p "$SKILL_DIR"
cp "$SCRIPT_DIR/mcp/skill/SKILL.md" "$SKILL_DIR/SKILL.md"
echo "  ✓ Skill installed to $SKILL_DIR"

echo ""
echo "═══════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "  API:      $API_URL"
echo "  Agent ID: $AGENT_ID"
echo "  MCP:      Registered (all projects)"
echo "  Skill:    ~/.claude/skills/threadron/"
echo ""
echo "  Restart Claude Code to activate."
echo "  The threadron_* tools will be available"
echo "  in every session, in every project."
echo ""
