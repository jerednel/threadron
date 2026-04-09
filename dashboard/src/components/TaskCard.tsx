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

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityDot = priorityColors[task.priority] || '#8a8a8a';

  return (
    <div
      onClick={onClick}
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 cursor-pointer hover:border-[#4a4a4a] transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-[#f0f0f0] leading-snug group-hover:text-white flex-1">
          {task.title}
        </h3>
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: priorityDot }}
          title={task.priority}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
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
