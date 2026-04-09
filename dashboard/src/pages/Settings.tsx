import { useState, useEffect, type FormEvent } from 'react';
import { api, type Domain, type Agent } from '../lib/api';
import NewDomain from '../components/NewDomain';
import NewProject from '../components/NewProject';

type Tab = 'domains' | 'agents' | 'apikeys' | 'preferences';

interface ApiKeyRecord {
  id: string;
  name: string;
  agent_id?: string | null;
  key_prefix: string;
  created_at: string;
}

const API_URL = 'https://api.tasksforagents.com';

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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'domains', label: 'Domains' },
    { id: 'agents', label: 'Agents' },
    { id: 'apikeys', label: 'API Keys' },
    { id: 'preferences', label: 'Preferences' },
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
