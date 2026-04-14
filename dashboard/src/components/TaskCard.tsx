import { useState } from 'react';
import type { Task } from '../lib/api';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityColors: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  urgent: '#ef4444',
};

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

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityDot = priorityColors[task.priority] || '#8a8a8a';
  const blockerCount = task.blockers?.length ?? 0;
  const hasBlockers = blockerCount > 0;
  const [idCopied, setIdCopied] = useState(false);

  return (
    <div
      onClick={onClick}
      className="bg-[#141414] border border-[#222] hover:border-[#333] rounded-lg p-4 cursor-pointer transition-colors group"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-[#f0f0f0] leading-snug group-hover:text-white flex-1">
          {task.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {task.claimed_by && (
            <span className="text-[9px] font-mono text-[#6a6a6a]" title={`claimed by ${task.claimed_by}`}>
              &#x1F512;
            </span>
          )}
          {task.guardrail === 'approval_required' && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-800/50 uppercase">
              approval
            </span>
          )}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: priorityDot }}
            title={task.priority}
          />
        </div>
      </div>

      {/* Next action — DOMINANT field */}
      {task.next_action && (
        <div className="mb-2.5">
          <p className="text-[13px] text-green-400/90 leading-snug font-medium">
            → {task.next_action}
          </p>
        </div>
      )}

      {/* Current state — secondary */}
      {task.current_state && (
        <div className="mb-2">
          <p className="text-xs text-[#8a8a8a] leading-snug line-clamp-2">
            {task.current_state}
          </p>
        </div>
      )}
      {!task.next_action && !task.current_state && <div className="mb-2" />}

      {/* Inline blocker — first blocker text */}
      {hasBlockers && task.blockers?.[0] && (
        <div className="mb-2">
          <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">BLOCKED</span>
          <p className="text-[11px] text-red-400/80 leading-snug mt-0.5 truncate">
            {task.blockers[0]}
          </p>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          {(task.assignee || task.claimed_by) && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400/80 border border-purple-800/30">
              {task.claimed_by || task.assignee}
            </span>
          )}
          <span className="text-[10px] font-mono text-[#3a3a3a]">
            {timeAgo(task.updated_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasBlockers && blockerCount > 1 && (
            <span className="text-[10px] font-mono text-red-400/60">
              +{blockerCount - 1} blocker{blockerCount > 2 ? 's' : ''}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(task.id).then(() => {
                setIdCopied(true);
                setTimeout(() => setIdCopied(false), 1500);
              });
            }}
            className="text-[9px] font-mono text-[#3a3a3a] hover:text-[#8a8a8a] transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            title={task.id}
          >
            {idCopied ? 'copied!' : 'ID'}
          </button>
        </div>
      </div>
    </div>
  );
}
