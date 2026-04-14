import { useState } from 'react';
import type { InboxItem } from '../lib/api';

interface InboxItemCardProps {
  item: InboxItem;
  onPromote: (id: string) => void;
  onReject: (id: string) => void;
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

const sourceBadgeColors: Record<string, string> = {
  dashboard: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
  mcp: 'bg-purple-900/30 text-purple-400 border-purple-800/50',
  api: 'bg-green-900/30 text-green-400 border-green-800/50',
  slack: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
};

export default function InboxItemCard({ item, onPromote, onReject }: InboxItemCardProps) {
  const [promoting, setPromoting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [flash, setFlash] = useState<'promoted' | 'rejected' | null>(null);

  const handlePromote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPromoting(true);
    setFlash('promoted');
    try {
      await onPromote(item.id);
    } finally {
      setPromoting(false);
      setTimeout(() => setFlash(null), 600);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRejecting(true);
    setFlash('rejected');
    try {
      await onReject(item.id);
    } finally {
      setRejecting(false);
      setTimeout(() => setFlash(null), 600);
    }
  };

  const sourceBadge = sourceBadgeColors[item.source] || 'bg-[#2a2a2a] text-[#6a6a6a] border-[#3a3a3a]';

  // Promoted / rejected — dimmed
  if (item.status === 'promoted') {
    return (
      <div className="px-3 py-2.5 border-b border-[#1e1e1e] opacity-50">
        <div className="flex items-center gap-2">
          <span className="text-green-500 text-xs">&#10003;</span>
          <span className="text-xs text-[#6a6a6a] font-mono line-through truncate">{item.raw_text}</span>
          <span className="text-[9px] font-mono text-[#4a4a4a] ml-auto shrink-0">Promoted</span>
        </div>
      </div>
    );
  }

  if (item.status === 'rejected') {
    return (
      <div className="px-3 py-2.5 border-b border-[#1e1e1e] opacity-50">
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-xs">&#10007;</span>
          <span className="text-xs text-[#6a6a6a] font-mono line-through truncate">{item.raw_text}</span>
          <span className="text-[9px] font-mono text-[#4a4a4a] ml-auto shrink-0">Rejected</span>
        </div>
      </div>
    );
  }

  // Error state
  if (item.status === 'error') {
    return (
      <div className="px-3 py-3 border-b border-red-900/40 bg-red-950/20">
        <p className="text-xs text-[#d8d8d8] font-mono mb-1">{item.raw_text}</p>
        <p className="text-[10px] text-red-400 font-mono">{item.error || 'Processing error'}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${sourceBadge}`}>{item.source}</span>
          <span className="text-[10px] font-mono text-[#4a4a4a]">{timeAgo(item.created_at)}</span>
        </div>
      </div>
    );
  }

  // Processing state
  if (item.status === 'processing') {
    return (
      <div className="px-3 py-3 border-b border-[#1e1e1e]">
        <p className="text-xs text-[#d8d8d8] mb-2">{item.raw_text}</p>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-[#4a4a4a] border-t-[#f0f0f0] rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-[#6a6a6a]">Processing...</span>
        </div>
      </div>
    );
  }

  // Parsed — ready to review
  if (item.status === 'parsed' && item.parsed) {
    return (
      <div className={`px-3 py-3 border-b border-[#1e1e1e] transition-all duration-300 ${
        flash === 'promoted' ? 'bg-green-950/30 translate-x-2 opacity-60' : flash === 'rejected' ? 'bg-red-950/20 opacity-60' : ''
      }`}>
        {/* Raw text */}
        <div className="border-l-2 border-[#2a2a2a] pl-2 mb-2">
          <p className="text-xs text-[#8a8a8a] italic">"{item.raw_text}"</p>
        </div>

        {/* Parsed suggestion divider */}
        <div className="h-px bg-gradient-to-r from-[#2a2a2a] via-[#1a1a1a] to-transparent my-2" />

        {/* Parsed fields */}
        <div className="space-y-1 mb-2.5">
          {item.parsed.title && (
            <div>
              <p className="text-sm text-[#f0f0f0] font-medium leading-snug">→ {item.parsed.title}</p>
            </div>
          )}
          {item.parsed.next_action && (
            <div>
              <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">NEXT</span>
              <p className="text-[11px] text-[#8a8a8a] leading-snug">{item.parsed.next_action}</p>
            </div>
          )}
          {item.parsed.project && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">PROJECT</span>
              <span className="text-[11px] text-[#8a8a8a]">{item.parsed.project}</span>
            </div>
          )}
          {item.parsed.confidence !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">CONFIDENCE</span>
              <span className={`text-[10px] font-mono ${
                item.parsed.confidence >= 0.8 ? 'text-green-400' :
                item.parsed.confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {Math.round(item.parsed.confidence * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePromote}
            disabled={promoting}
            className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-900/50 hover:border-green-700/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            {promoting ? '...' : 'Promote'}
          </button>
          <button
            onClick={handleReject}
            disabled={rejecting}
            className="px-2.5 py-1 rounded text-[10px] font-mono text-[#6a6a6a] border border-[#2a2a2a] hover:text-[#8a8a8a] hover:border-[#3a3a3a] transition-colors cursor-pointer disabled:opacity-50"
          >
            {rejecting ? '...' : 'Reject'}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${sourceBadge}`}>{item.source}</span>
            <span className="text-[10px] font-mono text-[#4a4a4a]">{timeAgo(item.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Unprocessed — raw text, minimal
  return (
    <div className="px-3 py-3 border-b border-[#1e1e1e]">
      <p className="text-xs text-[#d8d8d8] mb-1.5">{item.raw_text}</p>
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${sourceBadge}`}>{item.source}</span>
        <span className="text-[10px] font-mono text-[#4a4a4a]">{timeAgo(item.created_at)}</span>
      </div>
    </div>
  );
}
