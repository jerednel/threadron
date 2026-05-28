import { useEffect, useMemo, useState } from 'react';
import { api, type Thread } from '../lib/api';
import TaskDetailPanel from '../components/TaskDetail';
import NewThread from '../components/NewThread';

const statusOptions = ['active', 'paused', 'completed', 'archived'];

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export default function Threads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');
  const [handoffCopied, setHandoffCopied] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftStatus, setDraftStatus] = useState('active');
  const [draftCurrentState, setDraftCurrentState] = useState('');
  const [draftNextAction, setDraftNextAction] = useState('');
  const [draftBlockers, setDraftBlockers] = useState('');
  const [draftOutcome, setDraftOutcome] = useState('');
  const [draftConfidence, setDraftConfidence] = useState('');

  const loadThreads = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listThreads({
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      });
      const items = Array.isArray(data) ? data : [];
      setThreads(items);
      setSelectedThreadId(prev => {
        if (prev && items.some(t => t.id === prev)) return prev;
        return items[0]?.id || '';
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load threads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, [status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadThreads();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!selectedThreadId) {
      setSelectedThread(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    api.getThread(selectedThreadId)
      .then((thread) => {
        if (!cancelled) setSelectedThread(thread);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load thread');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId]);

  useEffect(() => {
    if (!selectedThread) return;
    setDraftName(selectedThread.name || '');
    setDraftStatus(selectedThread.status || 'active');
    setDraftCurrentState(selectedThread.current_state || '');
    setDraftNextAction(selectedThread.next_action || '');
    setDraftBlockers((selectedThread.blockers || []).join('\n'));
    setDraftOutcome(selectedThread.outcome_definition || '');
    setDraftConfidence(selectedThread.confidence || '');
    setSnapshotError('');

    const key = `threadron_thread_seen_${selectedThread.id}`;
    const previous = localStorage.getItem(key);
    if (!previous || new Date(selectedThread.updated_at).getTime() > new Date(previous).getTime()) {
      localStorage.setItem(key, new Date().toISOString());
    }
  }, [selectedThread]);

  function buildHandoffPrompt(thread: Thread) {
    const tasks = thread.tasks || [];
    const focusTask = tasks.find(task => task.id === thread.current_task_id) || tasks[0];
    return [
      `Resume Threadron thread ${thread.id}: ${thread.name}`,
      '',
      `Current state: ${thread.current_state || 'No current state recorded.'}`,
      `Next action: ${thread.next_action || focusTask?.next_action || 'Inspect the thread and choose the next action.'}`,
      `Blockers: ${(thread.blockers && thread.blockers.length > 0) ? thread.blockers.join('; ') : 'None recorded.'}`,
      `Current task: ${thread.current_task_id || focusTask?.id || 'none'}`,
      '',
      'First, call threadron_get_thread or threadron_resume for this thread. Then continue from the next action and update Threadron before replying.',
    ].join('\n');
  }

  async function handleCopyHandoff() {
    if (!selectedThread) return;
    await navigator.clipboard.writeText(buildHandoffPrompt(selectedThread));
    setHandoffCopied(true);
    setTimeout(() => setHandoffCopied(false), 1500);
  }

  function changedSinceLastLook(thread: Thread) {
    const key = `threadron_thread_seen_${thread.id}`;
    const previous = localStorage.getItem(key);
    if (!previous) return 'First time opening this thread on this browser.';
    const previousTime = new Date(previous).getTime();
    const changedTasks = (thread.tasks || []).filter(task => new Date(task.updated_at).getTime() > previousTime);
    if (new Date(thread.updated_at).getTime() <= previousTime && changedTasks.length === 0) return 'No changes since you last opened it here.';
    if (changedTasks.length === 0) return 'Thread resume state changed since you last opened it here.';
    return `${changedTasks.length} member ${changedTasks.length === 1 ? 'task changed' : 'tasks changed'} since you last opened it here.`;
  }

  async function refreshSelectedThread(threadId = selectedThreadId) {
    await loadThreads();
    if (threadId) {
      const refreshed = await api.getThread(threadId);
      setSelectedThread(refreshed);
      setSelectedThreadId(refreshed.id);
    }
  }

  async function handleSaveSnapshot() {
    if (!selectedThread || savingSnapshot) return;
    setSavingSnapshot(true);
    setSnapshotError('');
    try {
      const blockers = draftBlockers
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      const updated = await api.updateThread(selectedThread.id, {
        name: draftName.trim() || selectedThread.name,
        status: draftStatus,
        current_state: draftCurrentState.trim() || null,
        next_action: draftNextAction.trim() || null,
        blockers,
        outcome_definition: draftOutcome.trim() || null,
        confidence: draftConfidence.trim() || null,
      });
      setSelectedThread({ ...selectedThread, ...updated });
      await loadThreads();
    } catch (e: unknown) {
      setSnapshotError(e instanceof Error ? e.message : 'Failed to save thread');
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleSyncFromTask(taskId: string) {
    if (!selectedThread) return;
    setSavingSnapshot(true);
    setSnapshotError('');
    try {
      const updated = await api.syncThreadFromTask(selectedThread.id, taskId);
      setSelectedThread({ ...selectedThread, ...updated });
      await refreshSelectedThread(selectedThread.id);
    } catch (e: unknown) {
      setSnapshotError(e instanceof Error ? e.message : 'Failed to sync from task');
    } finally {
      setSavingSnapshot(false);
    }
  }

  const groupedThreads = useMemo(() => {
    const buckets = new Map<string, Thread[]>();
    for (const thread of threads) {
      const key = thread.status || 'active';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(thread);
    }
    return statusOptions
      .map((key) => ({ key, items: buckets.get(key) || [] }))
      .filter((group) => group.items.length > 0);
  }, [threads]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="border-b border-[#2a2a2a] px-4 md:px-6 py-4 shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#4a4a4a] mb-1">Threads</p>
            <h1 className="text-lg font-semibold text-white">Durable execution streams</h1>
            <p className="text-sm text-[#8a8a8a] mt-1 max-w-2xl">
              One thread per feature or worktree. Tasks are the pieces inside it; this page shows the shared state that survives across agents and machines.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads..."
              className="bg-[#141414] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#f0f0f0] font-mono focus:outline-none focus:border-[#4a4a4a] min-w-0"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-[#141414] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#f0f0f0] font-mono focus:outline-none focus:border-[#4a4a4a]"
            >
              <option value="">All statuses</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button
              onClick={() => setShowNewThread(true)}
              className="bg-[#f0f0f0] text-[#0a0a0a] px-4 py-2 rounded text-sm font-mono font-bold hover:bg-white transition-colors cursor-pointer"
            >
              + New Thread
            </button>
            <button
              onClick={loadThreads}
              className="border border-[#2a2a2a] text-[#8a8a8a] px-4 py-2 rounded text-sm font-mono hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-[36%] lg:w-[32%] border-r border-[#2a2a2a] overflow-auto">
          <div className="p-3 md:p-4 space-y-4">
            {loading && (
              <div className="text-center py-10">
                <span className="font-mono text-[#8a8a8a] text-sm">loading...</span>
              </div>
            )}

            {error && !loading && (
              <div className="text-center py-10">
                <p className="text-red-400 font-mono text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && groupedThreads.length === 0 && (
              <div className="border border-dashed border-[#222] rounded-lg p-8 text-center">
                <span className="text-[#4a4a4a] text-xs font-mono">No threads yet</span>
              </div>
            )}

            {!loading && !error && groupedThreads.map((group) => (
              <div key={group.key}>
                <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mb-2">
                  {group.key}
                </div>
                <div className="space-y-2">
                  {group.items.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                        selectedThreadId === thread.id
                          ? 'border-[#4a4a4a] bg-[#141414]'
                          : 'border-[#222] bg-[#101010] hover:border-[#333]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#f0f0f0] truncate">{thread.name}</div>
                          <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mt-1">
                            {thread.current_task_id ? 'active stream' : 'dormant'}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2a2a2a] text-[#8a8a8a]">
                          {thread.open_task_count ?? 0}/{thread.task_count ?? 0}
                        </span>
                      </div>
                      <div className="text-xs text-[#8a8a8a] line-clamp-2">
                        {thread.current_state || thread.next_action || 'No thread snapshot yet.'}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#4a4a4a]">
                        <span>{thread.status}</span>
                        <span>{timeAgo(thread.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {!selectedThreadId && !loading && !error && (
            <div className="h-full flex items-center justify-center text-[#4a4a4a] text-xs font-mono">
              Select a thread to inspect its resume snapshot.
            </div>
          )}

          {selectedThread && (
            <div className="p-4 md:p-6 space-y-5">
              <div className="flex flex-col gap-2 border border-[#1f1f1f] rounded-lg bg-[#101010] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">{selectedThread.name}</h2>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2a2a2a] text-[#8a8a8a] uppercase">
                        {selectedThread.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#8a8a8a] mt-2">
                      {selectedThread.current_state || 'No current state set.'}
                    </p>
                    <p className="text-xs text-[#6a6a6a] mt-2" title="Stored locally per browser; useful for quickly seeing whether this thread moved since you opened it.">
                      {changedSinceLastLook(selectedThread)}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyHandoff}
                    className="border border-[#2a2a2a] text-[#c0c0c0] px-3 py-1.5 rounded text-xs font-mono hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer shrink-0"
                    title="Copy a prompt any agent can paste to resume this thread through Threadron."
                  >
                    {handoffCopied ? 'Copied' : 'Copy handoff prompt'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-[#1f1f1f] rounded-lg bg-[#101010] p-4 md:col-span-2">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest">Resume Snapshot</div>
                      <div className="text-xs text-[#6a6a6a] mt-1">This is the handoff state agents read when they resume the thread.</div>
                    </div>
                    <button
                      onClick={handleSaveSnapshot}
                      disabled={savingSnapshot || !draftName.trim()}
                      className="bg-[#f0f0f0] text-[#0a0a0a] px-3 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingSnapshot ? 'Saving...' : 'Save Snapshot'}
                    </button>
                  </div>
                  {snapshotError && <p className="text-red-400 font-mono text-xs mb-3">{snapshotError}</p>}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Next action</div>
                      <textarea
                        value={draftNextAction}
                        onChange={e => setDraftNextAction(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
                        placeholder="The exact next move."
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Current state</div>
                      <textarea
                        value={draftCurrentState}
                        onChange={e => setDraftCurrentState(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
                        placeholder="What changed, what is true now?"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Name</div>
                      <input
                        value={draftName}
                        onChange={e => setDraftName(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Status</div>
                        <select
                          value={draftStatus}
                          onChange={e => setDraftStatus(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a]"
                        >
                          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Confidence</div>
                        <select
                          value={draftConfidence}
                          onChange={e => setDraftConfidence(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a]"
                        >
                          <option value="">unset</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Blockers</div>
                      <textarea
                        value={draftBlockers}
                        onChange={e => setDraftBlockers(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
                        placeholder="One blocker per line."
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-1">Outcome definition</div>
                      <textarea
                        value={draftOutcome}
                        onChange={e => setDraftOutcome(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
                        placeholder="What done looks like."
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-[#1f1f1f] rounded-lg bg-[#101010] p-4">
                  <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mb-2">Lineage</div>
                  <div className="space-y-2 text-sm text-[#c0c0c0]">
                    <div>Root task: {selectedThread.root_task_id || 'none'}</div>
                    <div>Current task: {selectedThread.current_task_id || 'none'}</div>
                    <div>Parent thread: {selectedThread.parent_thread_id || 'none'}</div>
                    <div>Source: {selectedThread.source || 'none'}</div>
                  </div>
                </div>
              </div>

              <div className="border border-[#1f1f1f] rounded-lg bg-[#101010] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest">Member Tasks</div>
                    <div className="text-sm text-[#8a8a8a] mt-1">Tasks currently attached to this thread.</div>
                  </div>
                  {detailLoading && <span className="font-mono text-[10px] text-[#6a6a6a]">loading...</span>}
                </div>
                <div className="space-y-2">
                  {(selectedThread.tasks || []).length === 0 ? (
                    <div className="text-xs text-[#4a4a4a] font-mono">No tasks attached yet.</div>
                  ) : (
                    (selectedThread.tasks || []).map((task) => (
                      <div key={task.id} className="rounded border border-[#222] bg-[#0f0f0f] hover:border-[#333] transition-colors">
                        <button
                          onClick={() => setSelectedTaskId(task.id)}
                          className="w-full text-left px-3 pt-2 pb-1.5 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm text-[#f0f0f0] truncate">{task.title}</div>
                              <div className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest mt-1">
                                {task.status} {task.assignee ? `· ${task.assignee}` : ''}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-[#6a6a6a]">{timeAgo(task.updated_at)}</span>
                          </div>
                          {(task.next_action || task.current_state) && (
                            <div className="text-xs text-[#8a8a8a] mt-2 line-clamp-2">
                              {task.next_action || task.current_state}
                            </div>
                          )}
                          {task.last_event && (
                            <div className="mt-2 border-l-2 border-[#2a2a2a] pl-2">
                              <div className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">
                                Last meaningful event · {task.last_event.type}
                              </div>
                              <div className="text-xs text-[#8a8a8a] line-clamp-2">{task.last_event.body}</div>
                            </div>
                          )}
                        </button>
                        <div className="flex items-center justify-between border-t border-[#1a1a1a] px-3 py-1.5">
                          <span className="text-[10px] font-mono text-[#3a3a3a]">
                            {task.context_count || 0} notes · {task.artifact_count || 0} artifacts
                          </span>
                          <button
                            onClick={() => handleSyncFromTask(task.id)}
                            disabled={savingSnapshot}
                            className="text-[10px] font-mono text-[#6a6a6a] hover:text-[#f0f0f0] transition-colors cursor-pointer disabled:opacity-40"
                          >
                            Sync snapshot
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={async () => {
            await Promise.all([loadThreads()]);
            if (selectedThreadId) {
              const refreshed = await api.getThread(selectedThreadId);
              setSelectedThread(refreshed);
            }
          }}
        />
      )}

      {showNewThread && (
        <NewThread
          onClose={() => setShowNewThread(false)}
          onCreated={(threadId) => {
            setSelectedThreadId(threadId);
            refreshSelectedThread(threadId);
          }}
        />
      )}
    </div>
  );
}
