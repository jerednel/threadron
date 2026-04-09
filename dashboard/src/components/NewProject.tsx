import { useState, useEffect, type FormEvent } from 'react';
import { api, type Domain } from '../lib/api';

interface NewProjectProps {
  onClose: () => void;
  onCreated: () => void;
  defaultDomainId?: string;
}

export default function NewProject({ onClose, onCreated, defaultDomainId }: NewProjectProps) {
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState(defaultDomainId || '');
  const [description, setDescription] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listDomains().then(setDomains).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !domainId) return;
    setLoading(true);
    setError('');
    try {
      await api.createProject({
        name: name.trim(),
        domain_id: domainId,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide">
            New Project
          </h2>
          <button
            onClick={onClose}
            className="text-[#8a8a8a] hover:text-[#f0f0f0] text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              required
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
            />
          </div>

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

          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
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
              disabled={loading || !name.trim() || !domainId}
              className="flex-1 bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? '...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
