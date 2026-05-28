import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

interface NewThreadProps {
  onClose: () => void;
  onCreated: (threadId: string) => void;
}

export default function NewThread({ onClose, onCreated }: NewThreadProps) {
  const [name, setName] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [outcomeDefinition, setOutcomeDefinition] = useState('');
  const [source, setSource] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const thread = await api.createThread({
        name: name.trim(),
        source: source.trim() || 'dashboard',
        status: 'active',
        ...(currentState.trim() ? { current_state: currentState.trim() } : {}),
        ...(nextAction.trim() ? { next_action: nextAction.trim() } : {}),
        ...(outcomeDefinition.trim() ? { outcome_definition: outcomeDefinition.trim() } : {}),
      });
      onCreated(thread.id);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create thread');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/60 hidden md:block" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] md:border md:border-[#2a2a2a] md:rounded-lg w-full md:max-w-lg h-full md:h-auto overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-sm font-bold text-[#f0f0f0] uppercase tracking-wide">
            New Thread
          </h2>
          <button
            onClick={onClose}
            className="text-[#8a8a8a] hover:text-[#f0f0f0] text-lg leading-none cursor-pointer"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Name *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Feature, worktree, or shared workstream"
              required
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Current State
            </label>
            <textarea
              value={currentState}
              onChange={e => setCurrentState(e.target.value)}
              placeholder="What should the next agent or human know first?"
              rows={3}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Next Action
            </label>
            <textarea
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              placeholder="The precise next move."
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Outcome Definition
            </label>
            <textarea
              value={outcomeDefinition}
              onChange={e => setOutcomeDefinition(e.target.value)}
              placeholder="What done looks like."
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a] resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
              Source
            </label>
            <input
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a]"
            />
          </div>

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

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
              {loading ? '...' : 'Create Thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
