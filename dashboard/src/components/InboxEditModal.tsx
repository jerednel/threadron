import { useState } from 'react';
import type { InboxItem } from '../lib/api';

interface InboxEditModalProps {
  item: InboxItem;
  onPromote: (id: string, fields: { title: string; next_action?: string; owner?: string }) => void;
  onClose: () => void;
}

export default function InboxEditModal({ item, onPromote, onClose }: InboxEditModalProps) {
  const [title, setTitle] = useState(item.parsed?.title || item.raw_text);
  const [nextAction, setNextAction] = useState(item.parsed?.next_action || '');
  const [owner, setOwner] = useState(item.parsed?.owner || '');
  const [promoting, setPromoting] = useState(false);

  async function handlePromote() {
    if (!title.trim()) return;
    setPromoting(true);
    await onPromote(item.id, {
      title: title.trim(),
      ...(nextAction.trim() ? { next_action: nextAction.trim() } : {}),
      ...(owner.trim() ? { owner: owner.trim() } : {}),
    });
    setPromoting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
          <span className="text-sm font-mono font-bold text-[#f0f0f0]">Edit & Promote</span>
          <button onClick={onClose} className="text-[#4a4a4a] hover:text-[#f0f0f0] text-lg cursor-pointer">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Original */}
          <div>
            <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">ORIGINAL</span>
            <p className="text-xs text-[#8a8a8a] italic mt-1">"{item.raw_text}"</p>
          </div>

          {/* Title */}
          <div>
            <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">TITLE</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-sm text-[#f0f0f0] font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#3a3a3a]"
              placeholder="Task title"
              autoFocus
            />
          </div>

          {/* Next Action */}
          <div>
            <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">NEXT ACTION</span>
            <input
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-sm text-green-400 font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#3a3a3a]"
              placeholder="What should happen next?"
            />
          </div>

          {/* Owner */}
          <div>
            <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">OWNER (OPTIONAL)</span>
            <input
              value={owner}
              onChange={e => setOwner(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-sm text-[#f0f0f0] font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#3a3a3a]"
              placeholder="Agent or person"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[#2a2a2a]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono text-[#6a6a6a] hover:text-[#f0f0f0] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handlePromote}
            disabled={!title.trim() || promoting}
            className="px-4 py-1.5 rounded text-xs font-mono font-bold bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-900/50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {promoting ? '...' : 'Promote'}
          </button>
        </div>
      </div>
    </div>
  );
}
