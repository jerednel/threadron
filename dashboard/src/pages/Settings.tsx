import { useState, useEffect, type FormEvent } from 'react';
import { api, type Domain, type Agent } from '../lib/api';
import NewDomain from '../components/NewDomain';
import NewProject from '../components/NewProject';

type Tab = 'domains' | 'agents' | 'apikeys' | 'preferences';

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function redactKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return '*'.repeat(key.length);
  return key.slice(0, 8) + '...' + key.slice(-4);
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; created_at: string }[]>([]);
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
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide mb-4">
            API Keys
          </h2>
          <p className="text-xs font-mono text-[#8a8a8a] mb-4">
            API keys are used by agents to authenticate with the API. Keys are shown redacted for security.
          </p>

          {/* Current key from local storage */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mb-4">
            <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
              Your API Key (current session)
            </div>
            <code className="font-mono text-sm text-[#f0f0f0]">
              {redactKey(localStorage.getItem('tfa_api_key') || '')}
            </code>
          </div>

          {apiKeys.length > 0 && (
            <div className="space-y-2">
              {apiKeys.map((k, i) => (
                <div
                  key={k.id || i}
                  className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3"
                >
                  <div>
                    <code className="font-mono text-sm text-[#f0f0f0]">{redactKey(k.key)}</code>
                    {k.created_at && (
                      <div className="text-[10px] font-mono text-[#4a4a4a] mt-1">
                        created: {formatDate(k.created_at)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {apiKeys.length === 0 && (
            <div className="border border-dashed border-[#2a2a2a] rounded-lg p-6 text-center">
              <p className="text-[#4a4a4a] font-mono text-sm">No additional API keys found.</p>
            </div>
          )}
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
