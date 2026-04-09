import { useState, useEffect, type FormEvent } from 'react';
import { api, type Domain, type Project, type Agent } from '../lib/api';

interface NewTaskProps {
  onClose: () => void;
  onCreated: () => void;
  defaultDomainId?: string;
}

const priorities = ['low', 'medium', 'high', 'urgent'];
const guardrails = ['autonomous', 'notify', 'approval_required'];

export default function NewTask({ onClose, onCreated, defaultDomainId }: NewTaskProps) {
  const [title, setTitle] = useState('');
  const [domainId, setDomainId] = useState(defaultDomainId || '');
  const [projectId, setProjectId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('medium');
  const [guardrail, setGuardrail] = useState('autonomous');
  const [tags, setTags] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listDomains().then(setDomains).catch(() => {});
    api.listAgents().then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    if (domainId) {
      api.listProjects(domainId).then(setProjects).catch(() => {});
    } else {
      setProjects([]);
    }
    setProjectId('');
  }, [domainId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !domainId) return;
    setLoading(true);
    setError('');
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      await api.createTask({
        title: title.trim(),
        domain_id: domainId,
        ...(projectId ? { project_id: projectId } : {}),
        ...(assignee ? { assignee } : {}),
        priority,
        guardrail,
        ...(tagList.length ? { tags: tagList } : {}),
        status: 'pending',
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide">
            New Task
          </h2>
          <button
            onClick={onClose}
            className="text-[#8a8a8a] hover:text-[#f0f0f0] text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Domain */}
            <div>
              <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                Domain *
              </label>
              <select
                value={domainId}
                onChange={e => setDomainId(e.target.value)}
                required
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
              >
                <option value="">Select domain</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                Project
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={!domainId}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer disabled:opacity-50"
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
              >
                {priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Guardrail */}
            <div>
              <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                Guardrail
              </label>
              <select
                value={guardrail}
                onChange={e => setGuardrail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
              >
                {guardrails.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Assignee
            </label>
            <select
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
            >
              <option value="">Unassigned</option>
              {agents.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm font-mono">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#2a2a2a] text-[#8a8a8a] py-2 rounded font-mono text-sm hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !domainId}
              className="flex-1 bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? '...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
