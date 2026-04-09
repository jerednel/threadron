import { useState, useEffect, type FormEvent } from 'react';
import { api, type TaskDetail as TaskDetailType, type ContextEntry } from '../lib/api';

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

const priorityColors: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];
const contextTypes = ['observation', 'decision', 'blocker', 'progress', 'artifact'];

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function TaskDetail({ taskId, onClose, onUpdate }: TaskDetailProps) {
  const [task, setTask] = useState<TaskDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Add context form state
  const [ctxType, setCtxType] = useState('observation');
  const [ctxBody, setCtxBody] = useState('');
  const [ctxAuthor, setCtxAuthor] = useState('dashboard');
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState('');

  async function loadTask() {
    setLoading(true);
    try {
      const t = await api.getTask(taskId);
      setTask(t);
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

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[520px] bg-[#0a0a0a] border-l border-[#2a2a2a] flex flex-col h-full overflow-hidden">
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
            {/* Task info */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-semibold text-[#f0f0f0] mb-4 leading-snug">
                {task.title}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Status */}
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Status
                  </label>
                  <select
                    value={task.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer disabled:opacity-50"
                  >
                    {statusOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Priority
                  </label>
                  <span className={`text-xs font-mono font-bold ${priorityColors[task.priority] || 'text-[#8a8a8a]'}`}>
                    {task.priority}
                  </span>
                </div>

                {/* Domain */}
                {task.domain && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                      Domain
                    </label>
                    <span className="text-xs font-mono text-[#f0f0f0]">{task.domain.name}</span>
                  </div>
                )}

                {/* Project */}
                {task.project && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                      Project
                    </label>
                    <span className="text-xs font-mono text-[#f0f0f0]">{task.project.name}</span>
                  </div>
                )}

                {/* Assignee */}
                {task.assignee && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                      Assignee
                    </label>
                    <span className="text-xs font-mono text-[#f0f0f0]">@{task.assignee}</span>
                  </div>
                )}

                {/* Guardrail */}
                {task.guardrail && (
                  <div>
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                      Guardrail
                    </label>
                    <span className={`text-xs font-mono ${task.guardrail === 'approval_required' ? 'text-yellow-400' : 'text-[#f0f0f0]'}`}>
                      {task.guardrail}
                    </span>
                  </div>
                )}

                {/* Created */}
                <div>
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Created
                  </label>
                  <span className="text-xs font-mono text-[#8a8a8a]">{formatDate(task.created_at)}</span>
                </div>
              </div>

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="mt-3">
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2a2a2a] text-[#8a8a8a]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Context log */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <h3 className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide mb-4">
                Context Log
              </h3>

              {(!task.context || task.context.length === 0) ? (
                <p className="text-[#4a4a4a] text-xs font-mono">No context entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {task.context.map((entry: ContextEntry) => (
                    <div key={entry.id} className="border border-[#2a2a2a] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${contextTypeColors[entry.type] || 'bg-[#2a2a2a] text-[#8a8a8a] border-[#2a2a2a]'}`}>
                            {entry.type}
                          </span>
                          <span className="text-[10px] font-mono text-[#4a4a4a]">@{entry.author}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#4a4a4a]">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-[#f0f0f0] leading-relaxed whitespace-pre-wrap">
                        {entry.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add context form */}
            <div className="p-6">
              <h3 className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wide mb-4">
                Add Context
              </h3>
              <form onSubmit={handleAddContext} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                      Type
                    </label>
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
                    <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                      Author
                    </label>
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
                  <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1">
                    Body
                  </label>
                  <textarea
                    value={ctxBody}
                    onChange={e => setCtxBody(e.target.value)}
                    placeholder="Enter context details..."
                    rows={3}
                    required
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[#f0f0f0] text-xs font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
                  />
                </div>

                {ctxError && (
                  <p className="text-red-400 text-xs font-mono">{ctxError}</p>
                )}

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
