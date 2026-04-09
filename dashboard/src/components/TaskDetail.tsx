import { useState, useEffect, type FormEvent } from 'react';
import { api, type TaskDetail as TaskDetailType, type ContextEntry, type Artifact } from '../lib/api';

interface TaskDetailProps {
  taskId: string;
  onClose: () => void;
  onUpdate: () => void;
}

// Timeline type badge config
const timelineTypeConfig: Record<string, { label: string; cls: string; dim?: boolean }> = {
  state_transition:    { label: 'state_transition',    cls: 'bg-[#2a2a2a] text-[#6a6a6a] border-[#3a3a3a]', dim: true },
  observation:         { label: 'observation',         cls: 'bg-blue-900/40 text-blue-400 border-blue-800/50' },
  action_taken:        { label: 'action_taken',        cls: 'bg-green-900/40 text-green-400 border-green-800/50' },
  decision:            { label: 'decision',            cls: 'bg-purple-900/40 text-purple-400 border-purple-800/50' },
  blocker:             { label: 'blocker',             cls: 'bg-red-900/40 text-red-400 border-red-800/50' },
  handoff:             { label: 'handoff',             cls: 'bg-orange-900/40 text-orange-400 border-orange-800/50' },
  proposal:            { label: 'proposal',            cls: 'bg-cyan-900/40 text-cyan-400 border-cyan-800/50' },
  artifact_created:    { label: 'artifact_created',    cls: 'bg-[#2a2a2a] text-[#6a6a6a] border-[#3a3a3a]', dim: true },
  approval_requested:  { label: 'approval_requested',  cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' },
  approval_received:   { label: 'approval_received',   cls: 'bg-green-900/40 text-green-400 border-green-800/50' },
  // Legacy types
  progress:            { label: 'progress',            cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' },
  artifact:            { label: 'artifact',            cls: 'bg-[#2a2a2a] text-[#6a6a6a] border-[#3a3a3a]', dim: true },
};

const actorTypeBadge: Record<string, { label: string; cls: string }> = {
  system: { label: 'SYS', cls: 'bg-[#1e1e1e] text-[#4a4a4a] border-[#2a2a2a]' },
  agent:  { label: 'AGT', cls: 'bg-blue-900/30 text-blue-500 border-blue-900/50' },
  human:  { label: 'HMN', cls: 'bg-green-900/30 text-green-500 border-green-900/50' },
};

const artifactTypeColors: Record<string, { cls: string; icon: string }> = {
  file:            { cls: 'bg-[#2a2a2a] text-[#8a8a8a] border-[#3a3a3a]',        icon: '◻' },
  branch:          { cls: 'bg-blue-900/40 text-blue-400 border-blue-800/50',       icon: '⑂' },
  commit:          { cls: 'bg-purple-900/40 text-purple-400 border-purple-800/50', icon: '◎' },
  pull_request:    { cls: 'bg-green-900/40 text-green-400 border-green-800/50',    icon: '⤴' },
  patch:           { cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50', icon: '⊞' },
  plan:            { cls: 'bg-cyan-900/40 text-cyan-400 border-cyan-800/50',       icon: '≡' },
  doc:             { cls: 'bg-[#2a2a2a] text-[#f0f0f0] border-[#4a4a4a]',         icon: '▤' },
  terminal_output: { cls: 'bg-orange-900/40 text-orange-400 border-orange-800/50', icon: '>' },
};

const priorityColors: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

const confidenceColors: Record<string, string> = {
  low: 'bg-red-900/40 text-red-400 border-red-800/50',
  medium: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  high: 'bg-green-900/40 text-green-400 border-green-800/50',
};

const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];
const contextTypes = ['observation', 'action_taken', 'decision', 'blocker', 'handoff', 'proposal', 'approval_requested', 'approval_received', 'progress', 'artifact'];
const artifactTypes = ['file', 'branch', 'commit', 'pull_request', 'patch', 'plan', 'doc', 'terminal_output'];

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

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

interface InlineEditProps {
  label: string;
  value: string;
  multiline?: boolean;
  prominent?: boolean;
  onSave: (val: string) => Promise<void>;
}

function InlineEdit({ label, value, multiline, prominent, onSave }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="mb-5">
        <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1.5">{label}</label>
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            rows={3}
            className="w-full bg-[#0f0f0f] border border-[#4a4a4a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none resize-none"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            className="w-full bg-[#0f0f0f] border border-[#4a4a4a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none"
          />
        )}
        {saving && <span className="text-[10px] font-mono text-[#6a6a6a]">saving...</span>}
      </div>
    );
  }

  return (
    <div className="mb-5 group/inline">
      <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1.5">{label}</label>
      <div
        onClick={() => { setDraft(value); setEditing(true); }}
        className={`leading-relaxed cursor-text min-h-[1.5rem] rounded px-2 py-1 -mx-2 group-hover/inline:bg-[#141414] transition-colors whitespace-pre-wrap ${
          prominent
            ? 'text-[15px] text-white font-medium'
            : 'text-sm text-[#d0d0d0]'
        }`}
      >
        {value || <span className="text-[#3a3a3a] italic text-sm font-normal">click to edit...</span>}
      </div>
    </div>
  );
}

export default function TaskDetail({ taskId, onClose, onUpdate }: TaskDetailProps) {
  const [task, setTask] = useState<TaskDetailType | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [releasingClaim, setReleasingClaim] = useState(false);

  // Add context form
  const [ctxType, setCtxType] = useState('observation');
  const [ctxBody, setCtxBody] = useState('');
  const [ctxAuthor, setCtxAuthor] = useState('dashboard');
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState('');

  // Add artifact form
  const [showArtifactForm, setShowArtifactForm] = useState(false);
  const [artType, setArtType] = useState('file');
  const [artTitle, setArtTitle] = useState('');
  const [artUri, setArtUri] = useState('');
  const [artBody, setArtBody] = useState('');
  const [artCreatedBy, setArtCreatedBy] = useState('dashboard');
  const [artLoading, setArtLoading] = useState(false);
  const [artError, setArtError] = useState('');

  // Blockers
  const [newBlocker, setNewBlocker] = useState('');

  async function loadTask() {
    setLoading(true);
    try {
      const t = await api.getTask(taskId);
      setTask(t);
      if (t.artifacts) {
        setArtifacts(t.artifacts);
      } else {
        try {
          const arts = await api.listArtifacts(taskId);
          setArtifacts(Array.isArray(arts) ? arts : []);
        } catch {
          setArtifacts([]);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
  }, [taskId]);

  async function handleStatusChange(newStatus: string) {
    if (!task) return;
    setUpdatingStatus(true);
    try {
      await api.updateTask(task.id, { status: newStatus });
      setTask(prev => prev ? { ...prev, status: newStatus } : null);
      onUpdate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleFieldSave(field: string, value: string) {
    if (!task) return;
    await api.updateTask(task.id, { [field]: value } as never);
    setTask(prev => prev ? { ...prev, [field]: value } : null);
    onUpdate();
  }

  async function handleAddBlocker() {
    if (!task || !newBlocker.trim()) return;
    const updated = [...(task.blockers || []), newBlocker.trim()];
    await api.updateTask(task.id, { blockers: updated } as never);
    setTask(prev => prev ? { ...prev, blockers: updated } : null);
    setNewBlocker('');
    onUpdate();
  }

  async function handleRemoveBlocker(idx: number) {
    if (!task) return;
    const updated = (task.blockers || []).filter((_, i) => i !== idx);
    await api.updateTask(task.id, { blockers: updated } as never);
    setTask(prev => prev ? { ...prev, blockers: updated } : null);
    onUpdate();
  }

  async function handleRelease() {
    if (!task) return;
    setReleasingClaim(true);
    try {
      await api.releaseTask(task.id);
      setTask(prev => prev ? { ...prev, claimed_by: undefined, claimed_until: undefined } : null);
      onUpdate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to release task');
    } finally {
      setReleasingClaim(false);
    }
  }

  async function handleAddContext(e: FormEvent) {
    e.preventDefault();
    if (!task || !ctxBody.trim()) return;
    setCtxLoading(true);
    setCtxError('');
    try {
      const entry = await api.addContext(task.id, {
        type: ctxType,
        body: ctxBody,
        author: ctxAuthor || 'dashboard',
      });
      setTask(prev => prev ? {
        ...prev,
        context: [...(prev.context || []), entry],
      } : null);
      setCtxBody('');
    } catch (e: unknown) {
      setCtxError(e instanceof Error ? e.message : 'Failed to add context');
    } finally {
      setCtxLoading(false);
    }
  }

  async function handleAddArtifact(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    setArtLoading(true);
    setArtError('');
    try {
      const artifact = await api.createArtifact(task.id, {
        type: artType,
        ...(artTitle ? { title: artTitle } : {}),
        ...(artUri ? { uri: artUri } : {}),
        ...(artBody ? { body: artBody } : {}),
        created_by: artCreatedBy || 'dashboard',
      });
      setArtifacts(prev => [...prev, artifact]);
      setArtTitle('');
      setArtUri('');
      setArtBody('');
      setShowArtifactForm(false);
    } catch (e: unknown) {
      setArtError(e instanceof Error ? e.message : 'Failed to add artifact');
    } finally {
      setArtLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[600px] bg-[#0a0a0a] border-l border-[#222] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e1e1e] shrink-0">
          <span className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest">Work Item</span>
          <button
            onClick={onClose}
            className="text-[#4a4a4a] hover:text-[#f0f0f0] text-lg leading-none cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-[#8a8a8a] text-sm">loading...</span>
          </div>
        )}

        {error && !loading && (
          <div className="p-6">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {task && !loading && (
          <div className="flex-1 overflow-y-auto">

            {/* ── STATE SUMMARY (HERO) ── */}
            <div className="px-6 pt-6 pb-5 border-b border-[#1e1e1e]">
              {/* Title */}
              <h2 className="text-lg font-semibold text-white mb-1 leading-snug">
                {task.title}
              </h2>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <select
                  value={task.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer disabled:opacity-50"
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <span className={`text-xs font-mono font-bold ${priorityColors[task.priority] || 'text-[#8a8a8a]'}`}>
                  {task.priority}
                </span>

                {task.confidence && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${confidenceColors[task.confidence] || ''}`}>
                    {task.confidence} confidence
                  </span>
                )}

                {task.guardrail === 'approval_required' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
                    approval required
                  </span>
                )}

                {task.claimed_by && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/40">
                      &#x1F512; {task.claimed_by}
                    </span>
                    <button
                      onClick={handleRelease}
                      disabled={releasingClaim}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2a2a2a] text-[#6a6a6a] hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {releasingClaim ? '...' : 'Release'}
                    </button>
                  </div>
                )}
              </div>

              {/* ━━━ State fields ━━━ */}
              <InlineEdit
                label="Goal"
                value={task.goal || ''}
                multiline
                onSave={v => handleFieldSave('goal', v)}
              />

              <InlineEdit
                label="Current State"
                value={task.current_state || ''}
                multiline
                prominent
                onSave={v => handleFieldSave('current_state', v)}
              />

              <InlineEdit
                label="Next Action"
                value={task.next_action || ''}
                multiline
                onSave={v => handleFieldSave('next_action', v)}
              />

              {/* Blockers */}
              <div className="mb-5">
                <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1.5">
                  Blockers
                </label>
                {task.blockers && task.blockers.length > 0 ? (
                  <div className="space-y-1.5 mb-2">
                    {task.blockers.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 bg-red-950/20 border border-red-900/30 rounded px-3 py-2">
                        <span className="text-red-500 font-mono text-xs mt-0.5">●</span>
                        <span className="text-sm text-[#f0f0f0] flex-1 leading-snug">{b}</span>
                        <button
                          onClick={() => handleRemoveBlocker(i)}
                          className="text-[#4a4a4a] hover:text-red-400 font-mono text-xs mt-0.5 cursor-pointer shrink-0 transition-colors"
                          title="Remove blocker"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#3a3a3a] text-xs font-mono mb-2">No blockers.</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlocker}
                    onChange={e => setNewBlocker(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBlocker(); } }}
                    placeholder="Add a blocker..."
                    className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                  />
                  <button
                    onClick={handleAddBlocker}
                    disabled={!newBlocker.trim()}
                    className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a2a] text-[#6a6a6a] hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              <InlineEdit
                label="Outcome"
                value={task.outcome_definition || ''}
                multiline
                onSave={v => handleFieldSave('outcome_definition', v)}
              />

              {/* Task metadata */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 pt-4 border-t border-[#1a1a1a] text-xs">
                {task.domain && (
                  <div>
                    <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest block mb-0.5">Domain</span>
                    <span className="font-mono text-[#a0a0a0]">{task.domain.name}</span>
                  </div>
                )}
                {task.assignee && (
                  <div>
                    <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest block mb-0.5">Assignee</span>
                    <span className="font-mono text-[#a0a0a0]">@{task.assignee}</span>
                  </div>
                )}
                {task.project && (
                  <div>
                    <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest block mb-0.5">Project</span>
                    <span className="font-mono text-[#a0a0a0]">{task.project.name}</span>
                  </div>
                )}
                <div>
                  <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest block mb-0.5">Created</span>
                  <span className="font-mono text-[#6a6a6a]">{formatDate(task.created_at)}</span>
                </div>
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {task.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2a2a2a] text-[#6a6a6a]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── TIMELINE ── */}
            <div className="px-6 py-5 border-b border-[#1e1e1e]">
              <h3 className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-4">Timeline</h3>

              {(!task.context || task.context.length === 0) ? (
                <p className="text-[#3a3a3a] text-xs font-mono">No entries yet.</p>
              ) : (
                <div className="space-y-0">
                  {[...task.context].reverse().map((entry: ContextEntry, idx: number, arr: ContextEntry[]) => {
                    const isSystem = entry.actor_type === 'system' || (!entry.actor_type && (entry.type === 'state_transition' || entry.type === 'artifact_created'));
                    const typeCfg = timelineTypeConfig[entry.type] || { label: entry.type, cls: 'bg-[#2a2a2a] text-[#8a8a8a] border-[#3a3a3a]' };
                    const isDim = isSystem || typeCfg.dim;
                    const badge = actorTypeBadge[entry.actor_type || (isSystem ? 'system' : 'agent')];
                    const isLast = idx === arr.length - 1;

                    return (
                      <div key={entry.id} className={`relative flex gap-3 ${isDim ? 'opacity-50' : ''}`}>
                        {/* Timeline line + dot */}
                        <div className="flex flex-col items-center shrink-0 mt-1">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isDim ? 'bg-[#2a2a2a]' : 'bg-[#4a4a4a]'}`} />
                          {!isLast && <div className="w-px flex-1 bg-[#1e1e1e] mt-1 mb-0 min-h-[20px]" />}
                        </div>

                        {/* Content */}
                        <div className={`pb-4 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[11px] font-mono text-[#8a8a8a]">
                              {entry.author}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${typeCfg.cls}`}>
                              {typeCfg.label}
                            </span>
                          </div>
                          {entry.body && (
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap mb-1 ${isDim ? 'text-[#5a5a5a]' : 'text-[#d0d0d0]'}`}>
                              {entry.body}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-[#3a3a3a]">
                              {timeAgo(entry.created_at)}
                            </span>
                            {badge && (
                              <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add context form */}
              <div className="mt-5 pt-4 border-t border-[#1a1a1a]">
                <h4 className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest mb-3">Add Entry</h4>
                <form onSubmit={handleAddContext} className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={ctxType}
                      onChange={e => setCtxType(e.target.value)}
                      className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#3a3a3a] cursor-pointer"
                    >
                      {contextTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={ctxAuthor}
                      onChange={e => setCtxAuthor(e.target.value)}
                      placeholder="author"
                      className="w-32 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                  <textarea
                    value={ctxBody}
                    onChange={e => setCtxBody(e.target.value)}
                    placeholder="Entry body..."
                    rows={2}
                    required
                    className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a] resize-none"
                  />
                  {ctxError && <p className="text-red-400 text-xs font-mono">{ctxError}</p>}
                  <button
                    type="submit"
                    disabled={ctxLoading || !ctxBody.trim()}
                    className="bg-[#f0f0f0] text-[#0a0a0a] px-4 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {ctxLoading ? '...' : 'Add Entry'}
                  </button>
                </form>
              </div>
            </div>

            {/* ── ARTIFACTS ── */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">Artifacts</h3>
                <button
                  onClick={() => setShowArtifactForm(v => !v)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#2a2a2a] text-[#6a6a6a] hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
                >
                  {showArtifactForm ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {artifacts.length === 0 && !showArtifactForm && (
                <p className="text-[#3a3a3a] text-xs font-mono">No artifacts yet.</p>
              )}

              {artifacts.length > 0 && (
                <div className="space-y-2 mb-4">
                  {artifacts.map(art => {
                    const typeCfg = artifactTypeColors[art.type] || { cls: 'bg-[#2a2a2a] text-[#8a8a8a] border-[#3a3a3a]', icon: '◻' };
                    return (
                      <div key={art.id} className="flex items-start gap-3 border border-[#1e1e1e] rounded-lg px-3 py-2.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${typeCfg.cls}`}>
                          {typeCfg.icon} {art.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          {art.title && (
                            <span className="text-sm text-[#f0f0f0] font-medium block">{art.title}</span>
                          )}
                          {art.uri && (
                            <a
                              href={art.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-blue-400 hover:text-blue-300 break-all block"
                            >
                              {art.uri}
                            </a>
                          )}
                          {art.body && (
                            <p className="text-xs text-[#6a6a6a] mt-1 whitespace-pre-wrap leading-relaxed">{art.body}</p>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-[#3a3a3a] shrink-0">by {art.created_by}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {showArtifactForm && (
                <form onSubmit={handleAddArtifact} className="space-y-3 border border-[#1e1e1e] rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1">Type</label>
                      <select
                        value={artType}
                        onChange={e => setArtType(e.target.value)}
                        className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#3a3a3a] cursor-pointer"
                      >
                        {artifactTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1">Created By</label>
                      <input
                        type="text"
                        value={artCreatedBy}
                        onChange={e => setArtCreatedBy(e.target.value)}
                        placeholder="dashboard"
                        className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1">Title</label>
                    <input
                      type="text"
                      value={artTitle}
                      onChange={e => setArtTitle(e.target.value)}
                      placeholder="Optional title"
                      className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1">URI</label>
                    <input
                      type="text"
                      value={artUri}
                      onChange={e => setArtUri(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#5a5a5a] uppercase tracking-widest mb-1">Body</label>
                    <textarea
                      value={artBody}
                      onChange={e => setArtBody(e.target.value)}
                      placeholder="Optional body text..."
                      rows={2}
                      className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#3a3a3a] resize-none"
                    />
                  </div>
                  {artError && <p className="text-red-400 text-xs font-mono">{artError}</p>}
                  <button
                    type="submit"
                    disabled={artLoading}
                    className="bg-[#f0f0f0] text-[#0a0a0a] px-4 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {artLoading ? '...' : 'Save Artifact'}
                  </button>
                </form>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
