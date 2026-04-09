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

const confidenceColors: Record<string, string> = {
  low: 'text-red-400',
  medium: 'text-yellow-400',
  high: 'text-green-400',
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityDot = priorityColors[task.priority] || '#8a8a8a';
  const isBlocked = task.blockers && task.blockers.length > 0;

  return (
    <div
      onClick={onClick}
      className={`bg-[#1a1a1a] border rounded-lg p-3 cursor-pointer hover:border-[#4a4a4a] transition-colors group ${
        isBlocked
          ? 'border-red-900/60 border-l-2 border-l-red-500 opacity-80'
          : 'border-[#2a2a2a]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-medium text-[#f0f0f0] leading-snug group-hover:text-white flex-1">
          {task.title}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0 mt-1">
          {isBlocked && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800/50 uppercase">
              blocked
            </span>
          )}
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: priorityDot }}
            title={task.priority}
          />
        </div>
      </div>

      {task.goal && (
        <p className="text-[11px] text-[#6a6a6a] leading-snug mb-2 line-clamp-2">
          {task.goal}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {task.claimed_by && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/40">
            {task.claimed_by}
          </span>
        )}
        {task.confidence && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] ${confidenceColors[task.confidence] || 'text-[#8a8a8a]'}`}>
            {task.confidence}
          </span>
        )}
        {task.domain && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#8a8a8a] uppercase tracking-wide">
            {task.domain.name}
          </span>
        )}
        {!task.domain && task.domain_id && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#8a8a8a]">
            {task.domain_id.slice(0, 8)}
          </span>
        )}
        {task.assignee && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#4a4a4a]">
            @{task.assignee}
          </span>
        )}
        {task.guardrail === 'approval_required' && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
            approval
          </span>
        )}
        {task.tags?.map(tag => (
          <span
            key={tag}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#8a8a8a]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
