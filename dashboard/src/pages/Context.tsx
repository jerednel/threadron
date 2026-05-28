import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type ContextObject, type Domain, type Thread } from '../lib/api';

const objectTypes = ['note', 'decision', 'resource', 'question', 'memory', 'incident', 'routine', 'person', 'org'];

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

export default function Context() {
  const [objects, setObjects] = useState<ContextObject[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftType, setDraftType] = useState('note');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftDomainId, setDraftDomainId] = useState('');
  const [draftThreadId, setDraftThreadId] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadContext() {
    setLoading(true);
    setError('');
    try {
      const [contextRes, domainRes, threadRes] = await Promise.all([
        api.listContextObjects({
          ...(type ? { type } : {}),
          ...(search ? { search } : {}),
        }),
        api.listDomains(),
        api.listThreads({ status: 'active' }),
      ]);
      setObjects(contextRes);
      setDomains(domainRes);
      setThreads(threadRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load context');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadContext, 200);
    return () => clearTimeout(timeout);
  }, [type, search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!draftTitle.trim() || !draftBody.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.createContextObject({
        type: draftType,
        title: draftTitle.trim(),
        body: draftBody.trim(),
        source: 'dashboard',
        created_by: 'user',
        ...(draftDomainId ? { domain_id: draftDomainId } : {}),
        ...(draftThreadId ? { thread_id: draftThreadId } : {}),
      });
      setDraftTitle('');
      setDraftBody('');
      await loadContext();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save context');
    } finally {
      setSaving(false);
    }
  }

  const groupedObjects = useMemo(() => {
    const buckets = new Map<string, ContextObject[]>();
    for (const object of objects) {
      if (!buckets.has(object.type)) buckets.set(object.type, []);
      buckets.get(object.type)!.push(object);
    }
    return objectTypes
      .map(key => ({ key, items: buckets.get(key) || [] }))
      .filter(group => group.items.length > 0);
  }, [objects]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="border-b border-[#2a2a2a] px-4 md:px-6 py-4 shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#4a4a4a] mb-1">Shared Context</p>
            <h1 className="text-lg font-semibold text-white">Notes, decisions, resources, questions</h1>
            <p className="text-sm text-[#8a8a8a] mt-1 max-w-2xl">
              Context objects are things to remember, not things to do. Use them for facts, durable choices, links, open unknowns, and reusable project memory.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search context..."
              className="bg-[#141414] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#f0f0f0] font-mono focus:outline-none focus:border-[#4a4a4a]"
            />
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="bg-[#141414] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#f0f0f0] font-mono focus:outline-none focus:border-[#4a4a4a]"
            >
              <option value="">All types</option>
              {objectTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-[38%] border-r border-[#2a2a2a] overflow-auto p-4">
          <form onSubmit={handleCreate} className="border border-[#1f1f1f] bg-[#101010] rounded-lg p-4 space-y-3">
            <div>
              <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mb-1">Universal capture</div>
              <p className="text-xs text-[#6a6a6a]">Dump a thought here when it should be remembered but is not actionable work.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={draftType} onChange={e => setDraftType(e.target.value)} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
                {objectTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <select value={draftDomainId} onChange={e => setDraftDomainId(e.target.value)} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
                <option value="">No domain</option>
                {domains.map(domain => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
              </select>
            </div>
            <select value={draftThreadId} onChange={e => setDraftThreadId(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
              <option value="">No thread</option>
              {threads.map(thread => <option key={thread.id} value={thread.id}>{thread.name}</option>)}
            </select>
            <input
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              placeholder="Short title"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a]"
            />
            <textarea
              value={draftBody}
              onChange={e => setDraftBody(e.target.value)}
              placeholder="What should future humans or agents know?"
              rows={5}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] resize-none"
            />
            <button
              type="submit"
              disabled={saving || !draftTitle.trim() || !draftBody.trim()}
              className="w-full bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Saving...' : 'Remember'}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {loading && <div className="text-[#8a8a8a] font-mono text-sm">loading...</div>}
          {error && <div className="text-red-400 font-mono text-sm">{error}</div>}
          {!loading && !error && groupedObjects.length === 0 && (
            <div className="border border-dashed border-[#222] rounded-lg p-8 text-center">
              <span className="text-[#4a4a4a] text-xs font-mono">No shared context yet</span>
            </div>
          )}
          <div className="space-y-6">
            {groupedObjects.map(group => (
              <div key={group.key}>
                <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mb-2">
                  {group.key} &middot; {group.items.length}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {group.items.map(object => (
                    <div key={object.id} className="border border-[#1f1f1f] bg-[#101010] rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h2 className="text-sm font-semibold text-[#f0f0f0]">{object.title}</h2>
                        <span className="text-[10px] font-mono text-[#4a4a4a] shrink-0">{timeAgo(object.updated_at)}</span>
                      </div>
                      <p className="text-sm text-[#c0c0c0] whitespace-pre-wrap">{object.body}</p>
                      <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono text-[#4a4a4a]">
                        {object.thread_id && <span title="Thread scope">thread: {object.thread_id}</span>}
                        {object.domain_id && <span title="Domain scope">domain: {object.domain_id}</span>}
                        <span title="Where this object came from">source: {object.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
