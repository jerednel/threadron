import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

interface NewDomainProps {
  onClose: () => void;
  onCreated: () => void;
}

const guardrails = ['autonomous', 'notify', 'approval_required'];

export default function NewDomain({ onClose, onCreated }: NewDomainProps) {
  const [name, setName] = useState('');
  const [defaultGuardrail, setDefaultGuardrail] = useState('autonomous');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.createDomain({ name: name.trim(), default_guardrail: defaultGuardrail });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create domain');
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
            New Domain
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
              placeholder="e.g. Work, Personal, Research"
              required
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Default Guardrail
            </label>
            <select
              value={defaultGuardrail}
              onChange={e => setDefaultGuardrail(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
            >
              {guardrails.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
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
              disabled={loading || !name.trim()}
              className="flex-1 bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? '...' : 'Create Domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
