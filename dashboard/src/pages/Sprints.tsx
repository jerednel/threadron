import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Domain, type Sprint, type Task, type Thread } from '../lib/api';

const commitmentOptions = ['committed', 'stretch', 'planned'];

function shortDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function Sprints() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<Sprint | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [domainId, setDomainId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [itemKind, setItemKind] = useState<'task' | 'thread'>('task');
  const [itemId, setItemId] = useState('');
  const [commitment, setCommitment] = useState('committed');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [sprintRes, domainRes, taskRes, threadRes] = await Promise.all([
        api.listSprints(),
        api.listDomains(),
        api.listTasks(),
        api.listThreads({ status: 'active' }),
      ]);
      setSprints(sprintRes);
      setDomains(domainRes);
      setTasks(taskRes);
      setThreads(threadRes);
      const active = sprintRes.find(s => s.status === 'active') || sprintRes[0] || null;
      setSelectedId(current => current || active?.id || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sprints');
    } finally {
      setLoading(false);
    }
  }

  async function loadSelected(id: string) {
    if (!id) {
      setSelected(null);
      return;
    }
    try {
      setSelected(await api.getSprint(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sprint');
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadSelected(selectedId); }, [selectedId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const sprint = await api.createSprint({
        name: name.trim(),
        goal: goal.trim() || undefined,
        status: 'active',
        domain_id: domainId || null,
        start_date: startDate || null,
        end_date: endDate || null,
        created_by: 'user',
      });
      setName('');
      setGoal('');
      setStartDate('');
      setEndDate('');
      await load();
      setSelectedId(sprint.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create sprint');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();
    if (!selected || !itemId || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.addSprintItem(selected.id, {
        ...(itemKind === 'task' ? { task_id: itemId } : { thread_id: itemId }),
        commitment_status: commitment,
        position: selected.items?.length || 0,
        added_by: 'user',
      });
      setItemId('');
      await loadSelected(selected.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add sprint item');
    } finally {
      setSaving(false);
    }
  }

  async function closeSprint() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await api.updateSprint(selected.id, { status: 'closed' });
      await load();
      await loadSelected(selected.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to close sprint');
    } finally {
      setSaving(false);
    }
  }

  const visibleItems = useMemo(() => (selected?.items || []).filter(item => item.commitment_status !== 'removed'), [selected]);
  const itemChoices = itemKind === 'task' ? tasks : threads;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="border-b border-[#2a2a2a] px-4 md:px-6 py-4 shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#4a4a4a] mb-1">Planning overlay</p>
            <h1 className="text-lg font-semibold text-white">Current sprint</h1>
            <p className="text-sm text-[#8a8a8a] mt-1 max-w-2xl">
              Time-boxed focus across tasks and threads. Sprints are optional; they do not replace projects, claims, or thread state.
            </p>
          </div>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-[#141414] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#f0f0f0] font-mono"
          >
            <option value="">No sprint</option>
            {sprints.map(sprint => (
              <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprint.status})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-[38%] border-r border-[#2a2a2a] overflow-auto p-4 space-y-4">
          <form onSubmit={handleCreate} className="border border-[#1f1f1f] bg-[#101010] rounded-lg p-4 space-y-3">
            <div>
              <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mb-1">Start sprint</div>
              <p className="text-xs text-[#6a6a6a]">Create a human planning window around the work that matters now.</p>
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Sprint name" className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a]" />
            <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Sprint goal" rows={3} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] resize-none" />
            <select value={domainId} onChange={e => setDomainId(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
              <option value="">All domains</option>
              {domains.map(domain => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono" />
            </div>
            <button disabled={saving || !name.trim()} className="w-full bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving...' : 'Start Sprint'}
            </button>
          </form>

          {selected && (
            <form onSubmit={handleAddItem} className="border border-[#1f1f1f] bg-[#101010] rounded-lg p-4 space-y-3">
              <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest">Add focus item</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={itemKind} onChange={e => { setItemKind(e.target.value as 'task' | 'thread'); setItemId(''); }} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
                  <option value="task">Task</option>
                  <option value="thread">Thread</option>
                </select>
                <select value={commitment} onChange={e => setCommitment(e.target.value)} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
                  {commitmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <select value={itemId} onChange={e => setItemId(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-[#f0f0f0] font-mono">
                <option value="">Select {itemKind}</option>
                {itemChoices.map(item => <option key={item.id} value={item.id}>{'title' in item ? item.title : item.name}</option>)}
              </select>
              <button disabled={saving || !itemId} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#f0f0f0] py-2 rounded font-mono text-sm hover:bg-[#222] transition-colors disabled:opacity-50 cursor-pointer">
                Add to Sprint
              </button>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {loading && <div className="text-[#8a8a8a] font-mono text-sm">loading...</div>}
          {error && <div className="text-red-400 font-mono text-sm mb-4">{error}</div>}
          {!loading && !selected && (
            <div className="border border-dashed border-[#222] rounded-lg p-8 text-center">
              <span className="text-[#4a4a4a] text-xs font-mono">No sprint selected</span>
            </div>
          )}
          {selected && (
            <div className="space-y-5">
              <div className="border border-[#1f1f1f] bg-[#101010] rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#4a4a4a] mb-1">{selected.status} sprint</div>
                    <h2 className="text-xl font-semibold text-white">{selected.name}</h2>
                    <p className="text-sm text-[#c0c0c0] mt-2 whitespace-pre-wrap">{selected.goal || 'No goal set.'}</p>
                  </div>
                  <button onClick={closeSprint} disabled={saving || selected.status === 'closed'} className="text-xs font-mono border border-[#2a2a2a] text-[#8a8a8a] px-3 py-2 rounded hover:text-white hover:border-[#4a4a4a] disabled:opacity-40 cursor-pointer">
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 mt-4 text-[10px] font-mono text-[#6a6a6a]">
                  {selected.start_date && <span>{shortDate(selected.start_date)} to {shortDate(selected.end_date)}</span>}
                  <span>{visibleItems.length} focus items</span>
                  {selected.domain_id && <span>domain: {selected.domain_id}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {visibleItems.map(item => {
                  const label = item.task?.title || item.thread?.name || item.task_id || item.thread_id;
                  const state = item.task?.current_state || item.thread?.current_state;
                  const next = item.task?.next_action || item.thread?.next_action;
                  return (
                    <div key={item.id} className="border border-[#1f1f1f] bg-[#101010] rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-sm font-semibold text-[#f0f0f0]">{label}</h3>
                        <span className="text-[10px] font-mono text-[#6a6a6a] shrink-0">{item.commitment_status}</span>
                      </div>
                      {state && <p className="text-sm text-[#c0c0c0] whitespace-pre-wrap">{state}</p>}
                      {next && <p className="text-xs text-[#8a8a8a] mt-2">Next: {next}</p>}
                      <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono text-[#4a4a4a]">
                        {item.task_id && <span>task: {item.task_id}</span>}
                        {item.thread_id && <span>thread: {item.thread_id}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
