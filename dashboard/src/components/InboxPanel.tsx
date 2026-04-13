import { useState, useRef, useCallback } from 'react';
import type { InboxItem } from '../lib/api';
import InboxItemCard from './InboxItemCard';
import InboxCapture, { type InboxCaptureHandle } from './InboxCapture';

interface InboxPanelProps {
  items: InboxItem[];
  loading: boolean;
  onPromote: (id: string) => void;
  onReject: (id: string) => void;
  onRefresh: () => void;
  defaultDomainId?: string;
}

export default function InboxPanel({ items, loading, onPromote, onReject, onRefresh, defaultDomainId }: InboxPanelProps) {
  const [recentCollapsed, setRecentCollapsed] = useState(true);
  const captureRef = useRef<InboxCaptureHandle>(null);

  const handleCaptureClick = useCallback(() => {
    captureRef.current?.focus();
  }, []);

  // Group items by status
  const unprocessed = items.filter(i => i.status === 'unprocessed');
  const processing = items.filter(i => i.status === 'processing');
  const parsed = items.filter(i => i.status === 'parsed');
  const errored = items.filter(i => i.status === 'error');
  const recent = items.filter(i => i.status === 'promoted' || i.status === 'rejected');

  const activeCount = unprocessed.length + processing.length + parsed.length + errored.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-widest">
            INBOX
          </span>
          {activeCount > 0 && (
            <span className="text-[9px] font-mono text-[#0a0a0a] bg-[#8a8a8a] rounded-full px-1.5 py-0.5 leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <button
          onClick={handleCaptureClick}
          className="text-[10px] font-mono text-[#6a6a6a] hover:text-[#f0f0f0] transition-colors cursor-pointer"
        >
          + Capture
        </button>
      </div>

      {/* Capture input */}
      <InboxCapture ref={captureRef} onCaptured={onRefresh} defaultDomainId={defaultDomainId} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <span className="font-mono text-[#8a8a8a] text-xs">loading...</span>
          </div>
        )}

        {/* Error items */}
        {errored.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-red-950/10">
              <span className="text-[9px] font-mono text-red-400/60 uppercase tracking-widest">
                ERRORS &middot; {errored.length}
              </span>
            </div>
            {errored.map(item => (
              <InboxItemCard key={item.id} item={item} onPromote={onPromote} onReject={onReject} />
            ))}
          </div>
        )}

        {/* Unprocessed items */}
        {unprocessed.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-[#111]">
              <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">
                UNPROCESSED &middot; {unprocessed.length}
              </span>
            </div>
            {unprocessed.map(item => (
              <InboxItemCard key={item.id} item={item} onPromote={onPromote} onReject={onReject} />
            ))}
          </div>
        )}

        {/* Processing items */}
        {processing.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-[#111]">
              <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">
                PROCESSING &middot; {processing.length}
              </span>
            </div>
            {processing.map(item => (
              <InboxItemCard key={item.id} item={item} onPromote={onPromote} onReject={onReject} />
            ))}
          </div>
        )}

        {/* Ready to review (parsed) */}
        {parsed.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-[#111]">
              <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">
                READY TO REVIEW &middot; {parsed.length}
              </span>
            </div>
            {parsed.map(item => (
              <InboxItemCard key={item.id} item={item} onPromote={onPromote} onReject={onReject} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && activeCount === 0 && recent.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="text-[#3a3a3a] text-xs font-mono mb-1">Inbox is empty</span>
            <span className="text-[#2a2a2a] text-[10px] font-mono">
              Press <kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#6a6a6a]">&#8984;K</kbd> to capture a thought
            </span>
          </div>
        )}

        {/* Empty active state with recent */}
        {!loading && activeCount === 0 && recent.length > 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <span className="text-[#3a3a3a] text-xs font-mono">All caught up</span>
          </div>
        )}

        {/* Recent (promoted/rejected) — collapsed by default */}
        {recent.length > 0 && (
          <div>
            <button
              onClick={() => setRecentCollapsed(v => !v)}
              className="w-full px-3 py-1.5 bg-[#0e0e0e] flex items-center gap-2 cursor-pointer hover:bg-[#111] transition-colors"
            >
              <span className="text-[9px] font-mono text-[#3a3a3a] uppercase tracking-widest">
                {recentCollapsed ? '\u25B6' : '\u25BC'} RECENT &middot; {recent.length}
              </span>
            </button>
            {!recentCollapsed && recent.map(item => (
              <InboxItemCard key={item.id} item={item} onPromote={onPromote} onReject={onReject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
