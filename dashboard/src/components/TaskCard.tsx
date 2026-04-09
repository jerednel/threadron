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

      {/* Current state — hero field */}
      <div className="mb-2">
        <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">STATE</span>
        <p className="text-[13px] text-white leading-snug mt-0.5 line-clamp-2">
          {task.current_state || <span className="text-[#3a3a3a] italic">No state set</span>}
        </p>
      </div>

      {/* Next action */}
      {task.next_action && (
        <div className="mb-3">
          <span className="text-[9px] font-mono text-[#4a4a4a] uppercase tracking-widest">NEXT</span>
          <p className="text-[12px] text-gray-400 leading-snug mt-0.5 line-clamp-1">
            {task.next_action}
          </p>
        </div>
      )}
      {!task.next_action && <div className="mb-3" />}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-mono text-gray-500">
          {task.assignee ? task.assignee : task.claimed_by ? task.claimed_by : '—'}
          {' · '}
          {timeAgo(task.updated_at)}
        </span>

        {hasBlockers && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-red-400">
            <span className="inline-flex gap-0.5">
              {Array.from({ length: Math.min(blockerCount, 4) }).map((_, i) => (
                <span key={i} className="w-1.5 h-2 bg-red-500 rounded-sm inline-block" />
              ))}
            </span>
            {blockerCount} {blockerCount === 1 ? 'blocker' : 'blockers'}
          </span>
        )}
      </div>
    </div>
  );
}
