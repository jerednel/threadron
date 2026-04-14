import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { api } from '../lib/api';

interface InboxCaptureProps {
  onCaptured: () => void;
  defaultDomainId?: string;
}

export interface InboxCaptureHandle {
  focus: () => void;
}

const InboxCapture = forwardRef<InboxCaptureHandle, InboxCaptureProps>(
  function InboxCapture({ onCaptured, defaultDomainId }, ref) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      },
    }));

    // Global Cmd+K handler
    useEffect(() => {
      function handleKeyDown(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    async function handleSubmit() {
      const trimmed = text.trim();
      if (!trimmed || submitting) return;
      setSubmitting(true);
      try {
        await api.captureInbox({
          raw_text: trimmed,
          source: 'dashboard',
          ...(defaultDomainId ? { domain_id: defaultDomainId } : {}),
        });
        setText('');
        setExpanded(false);
        onCaptured();
      } catch {
        // Silently fail — the item just won't appear
      } finally {
        setSubmitting(false);
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        setExpanded(false);
        inputRef.current?.blur();
      }
    }

    return (
      <div className="px-3 py-2 border-b border-[#2a2a2a]">
        <div
          className={`transition-all duration-150 ${expanded ? 'space-y-2' : ''}`}
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setExpanded(true)}
            onBlur={() => {
              if (!text.trim()) setExpanded(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Capture a thought… agents will structure it."
            rows={expanded ? 3 : 1}
            className={`w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-[#f0f0f0] font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#3a3a3a] resize-none transition-all duration-150 ${
              expanded ? 'min-h-[60px]' : 'min-h-[28px]'
            }`}
          />
          {expanded && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#3a3a3a]">
                Enter to capture &middot; Esc to cancel
              </span>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="px-3 py-1 rounded text-[10px] font-mono font-bold bg-[#f0f0f0] text-[#0a0a0a] hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? '...' : 'Capture'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default InboxCapture;
