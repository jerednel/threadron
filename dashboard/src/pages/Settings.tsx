import { useState, useEffect, type FormEvent } from 'react';
import { api, type Domain, type Agent } from '../lib/api';
import NewDomain from '../components/NewDomain';
import NewProject from '../components/NewProject';

type Tab = 'setup' | 'domains' | 'agents' | 'apikeys' | 'preferences' | 'telegram';

interface ApiKeyRecord {
  id: string;
  name: string;
  agent_id?: string | null;
  key_prefix: string;
  created_at: string;
}

const API_URL = 'https://threadron.com';

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}


export default function Settings() {
  const [tab, setTab] = useState<Tab>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  // Create key form
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyAgentId, setNewKeyAgentId] = useState('');
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [createKeyError, setCreateKeyError] = useState('');
  // Full key revealed after creation
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string; name: string } | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewDomain, setShowNewDomain] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  // Preferences form state
  const [approvalBehavior, setApprovalBehavior] = useState('');
  const [watchedSources, setWatchedSources] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // Telegram state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramPreview, setTelegramPreview] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [telegramSuccess, setTelegramSuccess] = useState('');

  async function loadDomains() {
    try {
      const res = await api.listDomains();
      setDomains(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }

  async function loadAgents() {
    try {
      const res = await api.listAgents();
      setAgents(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }

  async function loadApiKeys() {
    try {
      const res = await api.listApiKeys();
      const keys = Array.isArray(res) ? res : (res?.keys || []);
      setApiKeys(keys);
    } catch {
      setApiKeys([]);
    }
  }

  async function loadConfig() {
    try {
      const res = await api.getConfig();
      const cfg = res?.config || res || {};
      setConfig(cfg);
      setApprovalBehavior(String(cfg.approval_behavior || ''));
      const ws = cfg.watched_sources;
      setWatchedSources(Array.isArray(ws) ? ws.join(', ') : String(ws || ''));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([loadDomains(), loadAgents()])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.getTelegramConfig().then(cfg => {
      setTelegramConnected(cfg.connected);
      setTelegramChatId(cfg.chat_id || '');
      setTelegramPreview(cfg.token_preview);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'apikeys') loadApiKeys();
    if (tab === 'preferences') loadConfig();
  }, [tab]);

  async function handleDeleteDomain(id: string) {
    if (!confirm('Delete this domain? All associated tasks will be affected.')) return;
    try {
      await api.deleteDomain(id);
      await loadDomains();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleSavePreferences(e: FormEvent) {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMsg('');
    try {
      if (approvalBehavior) {
        await api.setConfig('approval_behavior', approvalBehavior);
      }
      const sources = watchedSources.split(',').map(s => s.trim()).filter(Boolean);
      if (sources.length > 0) {
        await api.setConfig('watched_sources', sources);
      }
      setConfigMsg('Saved.');
      await loadConfig();
    } catch (e: unknown) {
      setConfigMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreateKeyLoading(true);
    setCreateKeyError('');
    try {
      const res = await api.createApiKey({
        name: newKeyName.trim(),
        ...(newKeyAgentId.trim() ? { agent_id: newKeyAgentId.trim() } : {}),
      });
      setRevealedKey({ id: res.id, key: res.api_key, name: res.name });
      setNewKeyName('');
      setNewKeyAgentId('');
      setShowCreateKey(false);
      await loadApiKeys();
    } catch (err: unknown) {
      setCreateKeyError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreateKeyLoading(false);
    }
  }

  async function handleRevokeKey(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This cannot be undone.`)) return;
    try {
      await api.revokeApiKey(id);
      await loadApiKeys();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  }

  function handleCopyRevealedKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.key).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  }

  async function handleTelegramConnect() {
    setTelegramLoading(true);
    setTelegramError('');
    setTelegramSuccess('');
    try {
      const result = await api.updateTelegramConfig({ bot_token: telegramToken, chat_id: telegramChatId });
      setTelegramConnected(true);
      setTelegramSuccess(`Connected to @${result.bot_name || 'bot'}. Check Telegram for a test message.`);
      setTelegramPreview(telegramToken.substring(0, 10) + '...');
      setTelegramToken(''); // Clear the raw token from UI
    } catch (e: unknown) {
      setTelegramError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setTelegramLoading(false);
    }
  }

  async function handleTelegramDisconnect() {
    try {
      await api.deleteTelegramConfig();
      setTelegramConnected(false);
      setTelegramPreview(null);
      setTelegramChatId('');
      setTelegramSuccess('');
    } catch {
      // ignore
    }
  }

  const [setupTab, setSetupTab] = useState<'claude' | 'openclaw' | 'rest'>('claude');
  const [skillCopied, setSkillCopied] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [claudeMdCopied, setClaudeMdCopied] = useState(false);

  const SKILL_CONTENT = `---
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

Bad work items:
- "Handle all backend tasks" ← too broad
- "Various fixes and improvements" ← vague

### Rule 2: Always pair state updates with context

**Every time you change what you're doing, call BOTH:**
1. \`threadron_add_context\` — to explain WHY in the timeline
2. \`threadron_update_state\` — to update the structured fields

State fields tell the next reader WHAT. Context entries tell them WHY. Both are required.

### Rule 3: Don't create work items for everything

Only create work items for work that spans more than a quick exchange, benefits from tracking across sessions, or involves handoff between agents.

### Rule 4: Identify yourself

Each agent should have a unique identity — "openclaw", "hermes", "claude-code", etc.

## Session Start

At the **start of every session**, call \`threadron_checkin\` to see:
- Work items you left in progress (resume these first)
- Pending items assigned to you
- Blocked items that need attention
- **Unprocessed inbox items that need parsing**

If there's in-progress work, call \`threadron_get_task\` on it to read the full state before doing anything else.

## While Working

### The Update Pattern (use this every time something changes)

\`\`\`
1. threadron_add_context  → log what happened (observation, decision, action_taken)
2. threadron_update_state → update current_state and next_action
\`\`\`

Always log context FIRST, then update state.

### Examples:

- You investigate something → \`add_context(type: "observation", body: "Found X")\` → \`update_state(current_state: "Investigated, found X")\`
- You make a choice → \`add_context(type: "decision", body: "Going with approach A because...")\` → \`update_state(next_action: "Implement approach A")\`
- You complete a step → \`add_context(type: "action_taken", body: "Deployed to staging")\` → \`update_state(current_state: "Deployed to staging", next_action: "Run smoke tests")\`
- You hit a wall → \`add_context(type: "blocker", body: "Need API key for service X")\` → \`update_state(blockers: ["Need API key for service X"])\`

### Starting work

1. **Claim it** — \`threadron_claim\` before starting (prevents other agents from colliding)
2. **Update status** — \`threadron_update_state(status: "in_progress")\`

### Producing outputs

- \`threadron_create_artifact\` for branches, PRs, files, plans, terminal output
- Always pair with \`threadron_add_context(type: "action_taken", body: "Created branch X")\`

**Important — file artifacts:** Include file contents in the \`body\` field. Do NOT use \`uri\` with local paths or made-up URLs.

## Session End / Pausing

1. \`threadron_add_context(type: "action_taken", body: "Pausing. Summary...")\`
2. \`threadron_update_state\` — set current_state and next_action for the next session
3. \`threadron_release\` — release the claim
4. If done: \`threadron_update_state(status: "completed")\`

## Organizing Work — Projects

Projects group related work items within a domain.

- \`threadron_list_projects(domain_id?)\` — see existing projects
- \`threadron_create_project(name, domain_id, description?)\` — create a new project
- \`threadron_update_state(task_id, project_id)\` — assign a work item to a project

## Processing Inbox

The inbox is where raw, unstructured input lives before becoming tasks. At session start, \`threadron_checkin\` will tell you if there are unprocessed inbox items. **Process them.**

### The inbox processing loop

1. \`threadron_checkin\` reports e.g. "3 inbox items to parse"
2. \`threadron_list_inbox(status: "unprocessed")\` to see the raw text
3. For each item, interpret the \`raw_text\` and call \`threadron_parse_inbox\`:
   - \`title\` — clear, actionable task name (NOT the raw text repeated)
   - \`next_action\` — concrete first step (never the same as the title)
   - \`confidence\` — how sure you are ("0.8" = high, "0.5" = medium, "0.3" = low)
   - \`project\` — optional, if you can infer it
   - \`owner\` — optional, if you can infer who should do this

### Interpretation guidelines

Transform vague input into specific, actionable language:
- "fix dbt bug" → Title: "Fix mature_stores_weekly_count pipeline", Next: "Identify root cause of left-censoring logic"
- "rowan forms" → Title: "Complete Rowan Park West enrollment paperwork", Next: "Gather all required forms and documents"
- "buy milk" → Title: "Buy groceries", Next: "Purchase milk, check if anything else is needed"

### Rules

- **Never echo the raw text as the title.** Always transform it.
- **Never skip the next_action.** Every proposal needs a concrete first step.
- **Don't create tasks directly from inbox items.** Parse them — the user will Promote/Edit/Reject in the UI.

### Capturing new inbox items

When the user mentions something that should be tracked but isn't a fully formed task:
- \`threadron_capture_inbox(raw_text: "what they said", domain_id: "d_xyz")\`

## Creating New Work

1. **Check scope** — Is this a single, discrete goal? If not, break it up.
2. \`threadron_list_tasks\` with \`search\` to check it doesn't already exist
3. If the work belongs to a group, check if a project exists or create one
4. \`threadron_create_task\` with at minimum: title, domain_id, goal, and outcome_definition
5. Set current_state and next_action if you know them
6. **One work item per goal.** Never bundle unrelated tasks.

## Key Principles

**Write state for the next reader, not for yourself.** A different session — possibly a different agent — should be able to pick up any work item and immediately understand what's going on.

**The timeline IS the story.** Every state change needs a context entry explaining it.

**Threadron is not a to-do list.** It's shared execution state. Use it for work that needs continuity.`;

  const MCP_CONFIG = `{
  "mcpServers": {
    "threadron": {
      "type": "http",
      "url": "https://threadron.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

  const CLAUDE_MD_SNIPPET = `## Threadron

Use Threadron tools to track work across sessions:
- Start each session with \`threadron_checkin\` to see what's in progress
- Process any unprocessed inbox items with \`threadron_parse_inbox\`
- Before starting work, \`threadron_claim\` the item
- Update \`threadron_update_state\` as you make progress
- Record decisions and observations with \`threadron_add_context\`
- Attach outputs with \`threadron_create_artifact\`
- When done or pausing, \`threadron_release\` the item
- Capture loose thoughts with \`threadron_capture_inbox\``;

  function handleCopyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'setup', label: 'Agent Setup' },
    { id: 'domains', label: 'Domains' },
    { id: 'agents', label: 'Agents' },
    { id: 'apikeys', label: 'API Keys' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'telegram', label: 'Telegram' },
  ];

  return (
    <div className="p-6">
      <h1 className="font-mono text-lg font-bold text-[#f0f0f0] mb-6">Settings</h1>

      {/* Tab nav */}
      <div className="flex border-b border-[#2a2a2a] mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-mono transition-colors cursor-pointer border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[#f0f0f0] text-[#f0f0f0]'
                : 'border-transparent text-[#8a8a8a] hover:text-[#f0f0f0]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10">
          <span className="font-mono text-[#8a8a8a] text-sm">loading...</span>
        </div>
      )}

      {error && (
        <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
      )}

      {/* Setup tab */}
      {tab === 'setup' && (
        <div>
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide mb-2">
            Connect Your Agent
          </h2>
          <p className="text-xs font-mono text-[#9a9a9a] mb-6">
            Choose your agent below. Follow the steps exactly — each one takes under 2 minutes.
          </p>

          {/* Agent sub-tabs */}
          <div className="flex gap-2 mb-6">
            {([
              { id: 'claude' as const, label: 'Claude Code' },
              { id: 'openclaw' as const, label: 'OpenClaw' },
              { id: 'rest' as const, label: 'Any Agent (REST)' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setSetupTab(t.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                  setupTab === t.id
                    ? 'bg-[#f0f0f0] text-[#0a0a0a]'
                    : 'text-[#8a8a8a] hover:text-[#f0f0f0] bg-[#1a1a1a] border border-[#2a2a2a]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Claude Code setup */}
          {setupTab === 'claude' && (
            <div className="space-y-6">
              <div className="bg-[#111] border border-[#2a2a2a] rounded p-3 text-[10px] font-mono text-[#9a9a9a]">
                No installation required — the MCP server is hosted. No git clone, no npm install, no build step.
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-mono text-sm font-bold text-[#f0f0f0]">Step 1 — Add the MCP server</h3>
                  <button
                    onClick={() => handleCopyText(`claude mcp add --scope user --transport http threadron https://threadron.com/mcp --header "Authorization:Bearer YOUR_API_KEY"`, setMcpCopied)}
                    className="text-[10px] font-mono text-[#9a9a9a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-0.5"
                  >
                    {mcpCopied ? 'copied!' : 'copy command'}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">One command — connects Claude Code to the hosted Threadron MCP server globally (all projects).</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto">{`claude mcp add --scope user --transport http threadron https://threadron.com/mcp --header "Authorization:Bearer YOUR_API_KEY"`}</pre>
                <p className="text-[10px] font-mono text-[#9a9a9a] mt-2">Replace <code className="text-[#f0f0f0]">YOUR_API_KEY</code> with a key from the API Keys tab.</p>
                <p className="text-[10px] font-mono text-[#9a9a9a] mt-2">Or add to your project's <code className="text-[#f0f0f0]">.mcp.json</code>:</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto mt-2 whitespace-pre-wrap">{MCP_CONFIG}</pre>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-mono text-sm font-bold text-[#f0f0f0]">Step 2 — Install the skill file</h3>
                  <button
                    onClick={() => handleCopyText(`curl -sL https://raw.githubusercontent.com/jerednel/threadron/main/mcp/skill/SKILL.md -o ~/.claude/skills/threadron/SKILL.md --create-dirs`, setSkillCopied)}
                    className="text-[10px] font-mono text-[#9a9a9a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-0.5"
                  >
                    {skillCopied ? 'copied!' : 'copy command'}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">This tells Claude WHEN and HOW to use the tools (check in on session start, update state while working, etc).</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto">{`curl -sL https://raw.githubusercontent.com/jerednel/threadron/main/mcp/skill/SKILL.md -o ~/.claude/skills/threadron/SKILL.md --create-dirs`}</pre>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <h3 className="font-mono text-sm font-bold text-[#f0f0f0] mb-1">Step 3 — Restart Claude Code</h3>
                <p className="text-[10px] font-mono text-[#9a9a9a]">Exit and relaunch. Claude will prompt you to approve the Threadron MCP server on first use. After that, <code className="text-[#f0f0f0]">threadron_*</code> tools are available in every session.</p>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-mono text-sm font-bold text-[#f0f0f0]">Optional — Add to CLAUDE.md</h3>
                  <button
                    onClick={() => handleCopyText(CLAUDE_MD_SNIPPET, setClaudeMdCopied)}
                    className="text-[10px] font-mono text-[#9a9a9a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-0.5"
                  >
                    {claudeMdCopied ? 'copied!' : 'copy snippet'}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">Add this to any project's CLAUDE.md to reinforce the behavior in that specific project.</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto whitespace-pre-wrap">{CLAUDE_MD_SNIPPET}</pre>
              </div>

              {/* Available tools reference */}
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <h3 className="font-mono text-sm font-bold text-[#f0f0f0] mb-3">Available Tools (11)</h3>
                <div className="space-y-1.5">
                  {[
                    ['threadron_checkin', 'Session start — returns in-progress, pending, and blocked work'],
                    ['threadron_list_tasks', 'List/filter work items by status, assignee, domain, search'],
                    ['threadron_get_task', 'Full work item with goal, state, timeline, artifacts'],
                    ['threadron_create_task', 'Create with structured fields (goal, current_state, outcome)'],
                    ['threadron_update_state', 'Update current_state, next_action, blockers, confidence, status'],
                    ['threadron_add_context', 'Add timeline entries: observation, decision, action_taken, blocker, handoff'],
                    ['threadron_create_artifact', 'Attach branches, PRs, commits, files, plans, docs'],
                    ['threadron_claim', 'Claim before working (prevents collisions, auto-expires)'],
                    ['threadron_release', 'Release claim when done or pausing'],
                    ['threadron_list_domains', 'List available domains'],
                    ['threadron_list_agents', 'List registered agents and last activity'],
                  ].map(([name, desc]) => (
                    <div key={name} className="flex gap-3">
                      <code className="text-[11px] font-mono text-[#f0f0f0] shrink-0 w-48">{name}</code>
                      <span className="text-[11px] font-mono text-[#9a9a9a]">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* OpenClaw setup */}
          {setupTab === 'openclaw' && (
            <div className="space-y-6">
              <div className="bg-[#111] border border-[#2a2a2a] rounded p-3 text-[10px] font-mono text-[#9a9a9a]">
                No installation required — the MCP server is hosted. No git clone, no npm install, no build step.
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-mono text-sm font-bold text-[#f0f0f0]">Step 1 — Add the MCP server</h3>
                  <button
                    onClick={() => handleCopyText(`openclaw mcp set threadron '{"url":"https://threadron.com/mcp","headers":{"Authorization":"Bearer YOUR_API_KEY"}}'`, setMcpCopied)}
                    className="text-[10px] font-mono text-[#9a9a9a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-0.5"
                  >
                    {mcpCopied ? 'copied!' : 'copy command'}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">One command — connects OpenClaw to the hosted Threadron MCP server.</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto whitespace-pre-wrap">{`openclaw mcp set threadron '{"url":"https://threadron.com/mcp","headers":{"Authorization":"Bearer YOUR_API_KEY"}}'`}</pre>
                <p className="text-[10px] font-mono text-[#9a9a9a] mt-2">Replace <code className="text-[#f0f0f0]">YOUR_API_KEY</code> with a key from the API Keys tab.</p>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-mono text-sm font-bold text-[#f0f0f0]">Step 2 — Add skill instructions to system prompt</h3>
                  <button
                    onClick={() => handleCopyText(SKILL_CONTENT, setSkillCopied)}
                    className="text-[10px] font-mono text-[#9a9a9a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-0.5"
                  >
                    {skillCopied ? 'copied!' : 'copy skill'}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-[#9a9a9a]">Copy the skill file contents into OpenClaw's system prompt or instruction file. This tells the agent when and how to use the Threadron tools.</p>
              </div>
            </div>
          )}

          {/* REST API setup */}
          {setupTab === 'rest' && (
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <h3 className="font-mono text-sm font-bold text-[#f0f0f0] mb-1">Step 1 — Get the skill.md file</h3>
                <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">For agents that don't support MCP (Hermes, custom agents), use the REST API directly. The skill.md contains the complete API documentation and behavioral instructions.</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto">{`curl -sL https://raw.githubusercontent.com/jerednel/threadron/main/skill.md -o your-agent/instructions/threadron.md`}</pre>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <h3 className="font-mono text-sm font-bold text-[#f0f0f0] mb-1">Step 2 — Add to your agent's prompt</h3>
                <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">Copy the contents of <code className="text-[#f0f0f0]">skill.md</code> into your agent's system prompt, instruction file, or configuration. Set these environment variables:</p>
                <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs font-mono text-[#c0c0c0] overflow-x-auto">{`TFA_API_URL=${API_URL}/v1
TFA_API_KEY=YOUR_API_KEY
TFA_AGENT_ID=hermes`}</pre>
                <p className="text-[10px] font-mono text-[#9a9a9a] mt-2">Replace <code className="text-[#f0f0f0]">YOUR_API_KEY</code> with a key from the API Keys tab. Replace <code className="text-[#f0f0f0]">hermes</code> with your agent's name.</p>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5">
                <h3 className="font-mono text-sm font-bold text-[#f0f0f0] mb-3">Key REST endpoints</h3>
                <div className="space-y-1.5">
                  {[
                    ['GET  /tasks?assignee=ID&status=in_progress', 'Check for work on session start'],
                    ['POST /tasks/:id/claim', 'Claim before working'],
                    ['PATCH /tasks/:id', 'Update status, current_state, next_action, blockers'],
                    ['POST /tasks/:id/context', 'Add timeline entries (observation, decision, action_taken)'],
                    ['POST /tasks/:id/artifacts', 'Attach outputs (branch, PR, file, doc)'],
                    ['POST /tasks/:id/release', 'Release claim when done'],
                  ].map(([endpoint, desc]) => (
                    <div key={endpoint} className="flex gap-3">
                      <code className="text-[11px] font-mono text-[#f0f0f0] shrink-0">{endpoint}</code>
                      <span className="text-[11px] font-mono text-[#9a9a9a]">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Skill file — copyable */}
          <div className="mt-8 border border-[#2a2a2a] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-sm font-bold text-[#f0f0f0]">Full Skill File (SKILL.md)</h3>
              <button
                onClick={() => handleCopyText(SKILL_CONTENT, setSkillCopied)}
                className="text-[10px] font-mono text-[#9a9a9a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-1"
              >
                {skillCopied ? 'copied!' : 'copy entire file'}
              </button>
            </div>
            <p className="text-[10px] font-mono text-[#9a9a9a] mb-3">
              <strong className="text-[#f0f0f0]">Claude Code:</strong> Save to <code className="text-[#f0f0f0]">~/.claude/skills/threadron/SKILL.md</code><br/>
              <strong className="text-[#f0f0f0]">OpenClaw:</strong> Add to your system prompt or instruction file<br/>
              <strong className="text-[#f0f0f0]">Other agents:</strong> Include in the agent's prompt configuration
            </p>
            <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-4 text-[11px] font-mono text-[#9a9a9a] overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">{SKILL_CONTENT}</pre>
          </div>
        </div>
      )}

      {/* Domains tab */}
      {tab === 'domains' && !loading && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide">
              Domains
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewProject(true)}
                className="border border-[#2a2a2a] text-[#8a8a8a] px-3 py-1.5 rounded text-xs font-mono hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
              >
                + New Project
              </button>
              <button
                onClick={() => setShowNewDomain(true)}
                className="bg-[#f0f0f0] text-[#0a0a0a] px-3 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors cursor-pointer"
              >
                + New Domain
              </button>
            </div>
          </div>

          {domains.length === 0 ? (
            <div className="border border-dashed border-[#2a2a2a] rounded-lg p-8 text-center">
              <p className="text-[#4a4a4a] font-mono text-sm">No domains yet.</p>
              <button
                onClick={() => setShowNewDomain(true)}
                className="mt-3 text-xs font-mono text-[#8a8a8a] hover:text-[#f0f0f0] underline cursor-pointer"
              >
                Create your first domain
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map(d => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="font-mono text-sm text-[#f0f0f0] font-medium">{d.name}</span>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-mono text-[#8a8a8a]">
                        guardrail: <span className="text-[#f0f0f0]">{d.default_guardrail}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#4a4a4a]">
                        {formatDate(d.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDomain(d.id)}
                    className="text-[#4a4a4a] hover:text-red-400 text-xs font-mono transition-colors cursor-pointer"
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agents tab */}
      {tab === 'agents' && !loading && (
        <div>
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide mb-4">
            Registered Agents
          </h2>

          {agents.length === 0 ? (
            <div className="border border-dashed border-[#2a2a2a] rounded-lg p-8 text-center">
              <p className="text-[#4a4a4a] font-mono text-sm">No agents registered yet.</p>
              <p className="text-[#4a4a4a] font-mono text-xs mt-2">Agents register themselves when they first connect to the API.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="font-mono text-sm text-[#f0f0f0] font-medium">{a.name}</span>
                    <div className="flex items-center gap-3 mt-1">
                      {a.last_seen && (
                        <span className="text-[10px] font-mono text-[#8a8a8a]">
                          last seen: <span className="text-[#f0f0f0]">{formatDate(a.last_seen)}</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-[#4a4a4a]">
                        registered: {formatDate(a.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.last_seen && new Date(a.last_seen) > new Date(Date.now() - 5 * 60 * 1000) ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                        online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-[#4a4a4a]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4a4a4a] inline-block" />
                        offline
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* API Keys tab */}
      {tab === 'apikeys' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide">
              API Keys
            </h2>
            <button
              onClick={() => { setShowCreateKey(true); setCreateKeyError(''); }}
              className="bg-[#f0f0f0] text-[#0a0a0a] px-3 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors cursor-pointer"
            >
              + Create Key
            </button>
          </div>

          <p className="text-xs font-mono text-[#8a8a8a] mb-4">
            API keys authenticate agents with the API. Keys are shown once on creation, then redacted.
          </p>

          {/* Revealed key after creation */}
          {revealedKey && (
            <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-amber-400 text-xs font-mono font-bold uppercase tracking-wide">
                  Save this key now — it won't be shown again
                </p>
                <button
                  onClick={() => setRevealedKey(null)}
                  className="text-amber-600 hover:text-amber-400 text-xs font-mono cursor-pointer"
                >
                  dismiss
                </button>
              </div>
              <p className="text-amber-300/70 text-[10px] font-mono mb-3">Key: {revealedKey.name}</p>
              <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2">
                <code className="font-mono text-sm text-[#f0f0f0] flex-1 break-all">{revealedKey.key}</code>
                <button
                  onClick={handleCopyRevealedKey}
                  className="text-[10px] font-mono text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors cursor-pointer shrink-0 border border-[#2a2a2a] rounded px-2 py-1"
                >
                  {keyCopied ? 'copied!' : 'copy'}
                </button>
              </div>
            </div>
          )}

          {/* Create Key Form */}
          {showCreateKey && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mb-4">
              <h3 className="font-mono text-xs font-bold text-[#f0f0f0] uppercase tracking-wide mb-3">
                New API Key
              </h3>
              <form onSubmit={handleCreateKey} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="e.g. claude-agent-prod"
                    required
                    autoFocus
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Agent ID (optional)
                  </label>
                  <input
                    type="text"
                    value={newKeyAgentId}
                    onChange={e => setNewKeyAgentId(e.target.value)}
                    placeholder="e.g. agent-123"
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                  />
                </div>
                {createKeyError && (
                  <p className="text-red-400 text-xs font-mono">{createKeyError}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateKey(false)}
                    className="flex-1 border border-[#2a2a2a] text-[#8a8a8a] py-1.5 rounded font-mono text-xs hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createKeyLoading || !newKeyName.trim()}
                    className="flex-1 bg-[#f0f0f0] text-[#0a0a0a] py-1.5 rounded font-mono text-xs font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {createKeyLoading ? '...' : 'Create Key'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Keys list */}
          {apiKeys.length > 0 ? (
            <div className="space-y-2 mb-6">
              {apiKeys.map(k => (
                <div
                  key={k.id}
                  className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#f0f0f0] font-medium">{k.name}</span>
                      {k.agent_id && (
                        <span className="text-[10px] font-mono text-[#8a8a8a] border border-[#2a2a2a] rounded px-1.5 py-0.5">
                          agent: {k.agent_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-[10px] font-mono text-[#4a4a4a]">{k.key_prefix}</code>
                      <span className="text-[10px] font-mono text-[#4a4a4a]">
                        {formatDate(k.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeKey(k.id, k.name)}
                    className="text-[#4a4a4a] hover:text-red-400 text-xs font-mono transition-colors cursor-pointer"
                  >
                    revoke
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-[#2a2a2a] rounded-lg p-6 text-center mb-6">
              <p className="text-[#4a4a4a] font-mono text-sm">No API keys found.</p>
              <button
                onClick={() => setShowCreateKey(true)}
                className="mt-2 text-xs font-mono text-[#8a8a8a] hover:text-[#f0f0f0] underline cursor-pointer"
              >
                Create your first key
              </button>
            </div>
          )}

          {/* Skill.md setup snippet */}
          <div className="border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-3">
              Skill.md / MCP setup
            </div>
            <pre className="text-xs font-mono text-[#8a8a8a] overflow-x-auto whitespace-pre-wrap leading-relaxed">{`# API URL: ${API_URL}/v1
# API Key: <your-key-from-above>

# Example: list tasks
curl ${API_URL}/v1/tasks \\
  -H "Authorization: Bearer <your-key>"

# Example: create a task
curl -X POST ${API_URL}/v1/tasks \\
  -H "Authorization: Bearer <your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Review PR #123","status":"pending"}'`}</pre>
          </div>
        </div>
      )}

      {/* Preferences tab */}
      {tab === 'preferences' && (
        <div>
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide mb-4">
            Preferences
          </h2>

          <form onSubmit={handleSavePreferences} className="space-y-4 max-w-md">
            <div>
              <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                Approval Behavior
              </label>
              <input
                type="text"
                value={approvalBehavior}
                onChange={e => setApprovalBehavior(e.target.value)}
                placeholder="e.g. strict, lenient"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                Watched Sources (comma-separated)
              </label>
              <input
                type="text"
                value={watchedSources}
                onChange={e => setWatchedSources(e.target.value)}
                placeholder="github, jira, slack"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
              />
            </div>

            {/* Show raw config */}
            {Object.keys(config).length > 0 && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
                <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-2">
                  Current Config
                </div>
                <pre className="text-xs font-mono text-[#f0f0f0] overflow-auto">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>
            )}

            {configMsg && (
              <p className={`text-sm font-mono ${configMsg === 'Saved.' ? 'text-green-400' : 'text-red-400'}`}>
                {configMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={configSaving}
              className="bg-[#f0f0f0] text-[#0a0a0a] px-6 py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {configSaving ? '...' : 'Save Preferences'}
            </button>
          </form>
        </div>
      )}

      {/* Telegram tab */}
      {tab === 'telegram' && (
        <div className="max-w-md">
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide mb-6">
            Telegram
          </h2>

          {/* Telegram */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold text-[#f0f0f0]">Telegram Push-to-Agent</h3>
              {telegramConnected && (
                <span className="text-[10px] font-mono px-2 py-1 rounded bg-green-900/30 text-green-400 border border-green-800/50">
                  Connected
                </span>
              )}
            </div>

            <p className="text-xs text-[#6a6a6a] font-mono">
              Push tasks directly to your agent via Telegram. One-way dispatch — agents update progress through Threadron.
            </p>

            {telegramConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#141414] border border-[#222] rounded-lg">
                  <div>
                    <span className="text-xs font-mono text-[#8a8a8a]">Bot Token: </span>
                    <span className="text-xs font-mono text-[#f0f0f0]">{telegramPreview}</span>
                  </div>
                  <button
                    onClick={handleTelegramDisconnect}
                    className="text-[10px] font-mono text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="p-3 bg-[#141414] border border-[#222] rounded-lg">
                  <span className="text-xs font-mono text-[#8a8a8a]">Chat ID: </span>
                  <span className="text-xs font-mono text-[#f0f0f0]">{telegramChatId}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest block mb-1">Bot Token</label>
                  <input
                    type="password"
                    value={telegramToken}
                    onChange={e => setTelegramToken(e.target.value)}
                    placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
                    className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-xs text-[#f0f0f0] font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                  />
                  <span className="text-[9px] font-mono text-[#3a3a3a] mt-1 block">Get from @BotFather on Telegram</span>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest block mb-1">Chat ID</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={e => setTelegramChatId(e.target.value)}
                    placeholder="8302575789"
                    className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-xs text-[#f0f0f0] font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                  />
                  <span className="text-[9px] font-mono text-[#3a3a3a] mt-1 block">Get from @userinfobot on Telegram</span>
                </div>
                <button
                  onClick={handleTelegramConnect}
                  disabled={telegramLoading || !telegramToken || !telegramChatId}
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-[#f0f0f0] text-[#0a0a0a] hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {telegramLoading ? 'Connecting...' : 'Connect Telegram'}
                </button>
              </div>
            )}

            {telegramError && (
              <p className="text-xs font-mono text-red-400">{telegramError}</p>
            )}
            {telegramSuccess && (
              <p className="text-xs font-mono text-green-400">{telegramSuccess}</p>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewDomain && (
        <NewDomain
          onClose={() => setShowNewDomain(false)}
          onCreated={loadDomains}
        />
      )}
      {showNewProject && (
        <NewProject
          onClose={() => setShowNewProject(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
