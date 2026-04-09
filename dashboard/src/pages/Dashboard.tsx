import { useState, useEffect, useCallback } from 'react';
import { api, type Task, type Domain } from '../lib/api';
import TaskCard from '../components/TaskCard';
import TaskDetail from '../components/TaskDetail';
import NewTask from '../components/NewTask';
import Onboarding from '../components/Onboarding';

const COLUMNS = [
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'completed', label: 'Completed' },
];

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, domainsRes] = await Promise.all([
        api.listTasks(selectedDomainId ? { domain_id: selectedDomainId } : undefined),
        api.listDomains(),
      ]);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      const domainList = Array.isArray(domainsRes) ? domainsRes : [];
      setDomains(domainList);
      // Show onboarding for first-time users with no domains
      if (domainList.length === 0) {
        setShowOnboarding(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedDomainId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getColumnTasks(status: string): Task[] {
    return tasks.filter(t => t.status === status);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b border-[#2a2a2a] px-6 py-3 flex items-center justify-between shrink-0">
        {/* Domain filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setSelectedDomainId('')}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
              selectedDomainId === ''
                ? 'bg-[#f0f0f0] text-[#0a0a0a]'
                : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
            }`}
          >
            All
          </button>
          {domains.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDomainId(d.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                selectedDomainId === d.id
                  ? 'bg-[#f0f0f0] text-[#0a0a0a]'
                  : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={() => setShowNewTask(true)}
          className="bg-[#f0f0f0] text-[#0a0a0a] px-4 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors cursor-pointer shrink-0 ml-4"
        >
          + New Task
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <span className="font-mono text-[#8a8a8a] text-sm">loading...</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-10">
            <p className="text-red-400 font-mono text-sm">{error}</p>
            <button
              onClick={loadData}
              className="mt-3 text-xs font-mono text-[#8a8a8a] hover:text-[#f0f0f0] underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-4 gap-4 min-h-full">
            {COLUMNS.map(col => {
              const colTasks = getColumnTasks(col.id);
              return (
                <div key={col.id} className="flex flex-col min-h-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-mono font-bold text-[#8a8a8a] uppercase tracking-wider">
                      {col.label}
                    </h2>
                    <span className="text-xs font-mono text-[#4a4a4a] bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2">
                    {colTasks.length === 0 ? (
                      <div className="border border-dashed border-[#2a2a2a] rounded-lg p-4 text-center">
                        <span className="text-[#4a4a4a] text-xs font-mono">no tasks</span>
                      </div>
                    ) : (
                      colTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTaskId(task.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Detail Panel */}
      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadData}
        />
      )}

      {/* New Task Modal */}
      {showNewTask && (
        <NewTask
          onClose={() => setShowNewTask(false)}
          onCreated={loadData}
          defaultDomainId={selectedDomainId}
        />
      )}

      {/* Onboarding overlay for first-time users */}
      {showOnboarding && (
        <Onboarding
          onDismiss={() => {
            setShowOnboarding(false);
            // Reload to pick up newly created domain
            loadData();
          }}
        />
      )}
    </div>
  );
}
