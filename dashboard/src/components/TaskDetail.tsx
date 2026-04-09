import { useState, useEffect, type FormEvent } from 'react';
import { api, type TaskDetail as TaskDetailType, type ContextEntry, type Artifact } from '../lib/api';

interface TaskDetailProps {
  taskId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const contextTypeColors: Record<string, string> = {
  observation: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
  decision: 'bg-green-900/40 text-green-400 border-green-800/50',
  blocker: 'bg-red-900/40 text-red-400 border-red-800/50',
  progress: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  artifact: 'bg-purple-900/40 text-purple-400 border-purple-800/50',
};

const actorTypeBadge: Record<string, { label: string; cls: string }> = {
  system: { label: 'SYS', cls: 'bg-[#2a2a2a] text-[#6a6a6a] border-[#3a3a3a]' },
  agent:  { label: 'AGT', cls: 'bg-blue-900/40 text-blue-400 border-blue-800/50' },
  human:  { label: 'HMN', cls: 'bg-green-900/40 text-green-400 border-green-800/50' },
};

const artifactTypeColors: Record<string, string> = {
  file:            'bg-[#2a2a2a] text-[#8a8a8a] border-[#3a3a3a]',
  branch:          'bg-blue-900/40 text-blue-400 border-blue-800/50',
  commit:          'bg-purple-900/40 text-purple-400 border-purple-800/50',
  pull_request:    'bg-green-900/40 text-green-400 border-green-800/50',
  patch:           'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  plan:            'bg-cyan-900/40 text-cyan-400 border-cyan-800/50',
  doc:             'bg-[#2a2a2a] text-[#f0f0f0] border-[#4a4a4a]',
  terminal_output: 'bg-orange-900/40 text-orange-400 border-orange-800/50',
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
const contextTypes = ['observation', 'decision', 'blocker', 'progress', 'artifact'];
const artifactTypes = ['file', 'branch', 'commit', 'pull_request', 'patch', 'plan', 'doc', 'terminal_output'];

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

interface InlineEditProps {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (val: string) => Promise<void>;
}

function InlineEdit({ label, value, multiline, onSave }: InlineEditProps) {
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
      <div className="mb-3">
        <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">{label}</label>
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            rows={3}
            className="w-full bg-[#0a0a0a] border border-[#4a4a4a] rounded px-2 py-1.5 text-[#f0f0f0] text-sm font-mono focus:outline-none resize-none"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            className="w-full bg-[#0a0a0a] border border-[#4a4a4a] rounded px-2 py-1.5 text-[#f0f0f0] text-sm font-mono focus:outline-none"
          />
        )}
        {saving && <span className="text-[10px] font-mono text-[#6a6a6a]">saving...</span>}
      </div>
    );
  }

  return (
    <div className="mb-3 group/inline">
      <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">{label}</label>
      <div
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-sm text-[#f0f0f0] leading-relaxed cursor-text min-h-[1.5rem] rounded px-1 -mx-1 group-hover/inline:bg-[#1a1a1a] transition-colors whitespace-pre-wrap"
      >
        {value || <span className="text-[#4a4a4a] italic">click to edit...</span>}
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

  // Add blocker form
  const [newBlocker, setNewBlocker] = useState('');

  async function loadTask() {
    setLoading(true);
    try {
      const t = await api.getTask(taskId);
      setTask(t);
      // Load artifacts separately if not embedded
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
      <div className="w-[580px] bg-[#0a0a0a] border-l border-[#2a2a2a] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <span className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide">Task Detail</span>
          <button
            onClick={onClose}
            className="text-[#8a8a8a] hover:text-[#f0f0f0] text-lg leading-none cursor-pointer"
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

            {/* ── Header section ── */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-semibold text-[#f0f0f0] mb-4 leading-snug">
                {task.title}
              </h2>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Status */}
                <select
                  value={task.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer disabled:opacity-50"
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Priority */}
                <span className={`text-xs font-mono font-bold ${priorityColors[task.priority] || 'text-[#8a8a8a]'}`}>
                  {task.priority}
                </span>

                {/* Confidence */}
                {task.confidence && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${confidenceColors[task.confidence] || ''}`}>
                    {task.confidence} confidence
                  </span>
                )}

                {/* Guardrail */}
                {task.guardrail === 'approval_required' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
                    approval required
                  </span>
                )}
              </div>

              {/* Claimed by */}
              {task.claimed_by && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/40">
                    claimed by {task.claimed_by}
                  </span>
                  {task.claimed_until && (
                    <span className="text-[10px] font-mono text-[#6a6a6a]">
                      until {formatDate(task.claimed_until)}
                    </span>
                  )}
                  <button
                    onClick={handleRelease}
                    disabled={releasingClaim}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#3a3a3a] text-[#8a8a8a] hover:text-[#f0f0f0] hover:border-[#5a5a5a] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {releasingClaim ? '...' : 'Release'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                {task.domain && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Domain</label>
                    <span className="font-mono text-[#f0f0f0]">{task.domain.name}</span>
                  </div>
                )}
                {task.project && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Project</label>
                    <span className="font-mono text-[#f0f0f0]">{task.project.name}</span>
                  </div>
                )}
                {task.assignee && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Assignee</label>
                    <span className="font-mono text-[#f0f0f0]">@{task.assignee}</span>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Created</label>
                  <span className="font-mono text-[#8a8a8a]">{formatDate(task.created_at)}</span>
                </div>
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="mt-3">
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2a2a2a] text-[#8a8a8a]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Work State section ── */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <h3 className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide mb-4">Work State</h3>

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
                onSave={v => handleFieldSave('current_state', v)}
              />
              <InlineEdit
                label="Next Action"
                value={task.next_action || ''}
                multiline
                onSave={v => handleFieldSave('next_action', v)}
              />
              <InlineEdit
                label="Outcome Definition"
                value={task.outcome_definition || ''}
                multiline
                onSave={v => handleFieldSave('outcome_definition', v)}
              />

              {/* Blockers */}
              <div className="mb-3">
                <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-2">Blockers</label>
                {task.blockers && task.blockers.length > 0 ? (
                  <div className="space-y-1.5 mb-2">
                    {task.blockers.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 bg-red-900/10 border border-red-900/30 rounded px-2 py-1.5">
                        <span className="text-sm text-[#f0f0f0] flex-1 leading-snug">{b}</span>
                        <button
                          onClick={() => handleRemoveBlocker(i)}
                          className="text-[#6a6a6a] hover:text-red-400 font-mono text-xs mt-0.5 cursor-pointer shrink-0"
                          title="Remove blocker"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#4a4a4a] text-xs font-mono mb-2">No blockers.</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlocker}
                    onChange={e => setNewBlocker(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBlocker(); } }}
                    placeholder="Describe a blocker..."
                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                  />
                  <button
                    onClick={handleAddBlocker}
                    disabled={!newBlocker.trim()}
                    className="text-xs font-mono px-2 py-1 rounded border border-[#2a2a2a] text-[#8a8a8a] hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* ── Artifacts section ── */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide">Artifacts</h3>
                <button
                  onClick={() => setShowArtifactForm(v => !v)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#2a2a2a] text-[#8a8a8a] hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
                >
                  {showArtifactForm ? 'Cancel' : '+ Add Artifact'}
                </button>
              </div>

              {artifacts.length === 0 && !showArtifactForm && (
                <p className="text-[#4a4a4a] text-xs font-mono">No artifacts yet.</p>
              )}

              {artifacts.length > 0 && (
                <div className="space-y-2 mb-3">
                  {artifacts.map(art => (
                    <div key={art.id} className="border border-[#2a2a2a] rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${artifactTypeColors[art.type] || 'bg-[#2a2a2a] text-[#8a8a8a] border-[#3a3a3a]'}`}>
                          {art.type}
                        </span>
                        {art.title && (
                          <span className="text-sm text-[#f0f0f0] font-medium">{art.title}</span>
                        )}
                        <span className="text-[10px] font-mono text-[#4a4a4a] ml-auto">by {art.created_by}</span>
                      </div>
                      {art.uri && (
                        <a
                          href={art.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-blue-400 hover:text-blue-300 break-all"
                        >
                          {art.uri}
                        </a>
                      )}
                      {art.body && (
                        <p className="text-xs text-[#8a8a8a] mt-1 whitespace-pre-wrap leading-relaxed">{art.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showArtifactForm && (
                <form onSubmit={handleAddArtifact} className="space-y-3 border border-[#2a2a2a] rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Type</label>
                      <select
                        value={artType}
                        onChange={e => setArtType(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
                      >
                        {artifactTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Created By</label>
                      <input
                        type="text"
                        value={artCreatedBy}
                        onChange={e => setArtCreatedBy(e.target.value)}
                        placeholder="dashboard"
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Title</label>
                    <input
                      type="text"
                      value={artTitle}
                      onChange={e => setArtTitle(e.target.value)}
                      placeholder="Optional title"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">URI</label>
                    <input
                      type="text"
                      value={artUri}
                      onChange={e => setArtUri(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Body</label>
                    <textarea
                      value={artBody}
                      onChange={e => setArtBody(e.target.value)}
                      placeholder="Optional body text..."
                      rows={2}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
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

            {/* ── Context Log ── */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <h3 className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide mb-4">Context Log</h3>

              {(!task.context || task.context.length === 0) ? (
                <p className="text-[#4a4a4a] text-xs font-mono">No context entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {task.context.map((entry: ContextEntry) => {
                    const isSystem = entry.actor_type === 'system' || (!entry.actor_type && entry.author === 'system');
                    const badge = actorTypeBadge[entry.actor_type || 'human'];
                    return (
                      <div
                        key={entry.id}
                        className={`border rounded-lg p-3 ${isSystem ? 'border-[#1e1e1e] opacity-60' : 'border-[#2a2a2a]'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {badge && (
                              <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${contextTypeColors[entry.type] || 'bg-[#2a2a2a] text-[#8a8a8a] border-[#2a2a2a]'}`}>
                              {entry.type}
                            </span>
                            <span className="text-[10px] font-mono text-[#4a4a4a]">@{entry.author}</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#4a4a4a]">
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isSystem ? 'text-[#6a6a6a]' : 'text-[#f0f0f0]'}`}>
                          {entry.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Add Context ── */}
            <div className="p-6">
              <h3 className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide mb-4">Add Context</h3>
              <form onSubmit={handleAddContext} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Type</label>
                    <select
                      value={ctxType}
                      onChange={e => setCtxType(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
                    >
                      {contextTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Author</label>
                    <input
                      type="text"
                      value={ctxAuthor}
                      onChange={e => setCtxAuthor(e.target.value)}
                      placeholder="dashboard"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">Body</label>
                  <textarea
                    value={ctxBody}
                    onChange={e => setCtxBody(e.target.value)}
                    placeholder="Enter context details..."
                    rows={3}
                    required
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
                  />
                </div>
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
        )}
      </div>
    </div>
  );
}
