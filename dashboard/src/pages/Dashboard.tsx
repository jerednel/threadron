import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, type Task, type Domain, type Project, type InboxItem } from '../lib/api';
import TaskCard from '../components/TaskCard';
import TaskDetail from '../components/TaskDetail';
import NewTask from '../components/NewTask';
import NewProject from '../components/NewProject';
import Onboarding from '../components/Onboarding';
import InboxPanel from '../components/InboxPanel';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('tfa_onboarding_done') === 'true'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inbox state
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  // Mobile pane toggle: 'inbox' | 'tasks'
  const [mobilePane, setMobilePane] = useState<'inbox' | 'tasks'>('tasks');

  // Load projects when domain changes
  useEffect(() => {
    if (selectedDomainId) {
      api.listProjects(selectedDomainId).then(setProjects).catch(() => setProjects([]));
    } else {
      api.listProjects().then(setProjects).catch(() => setProjects([]));
    }
    setSelectedProjectId('');
    setSelectedTags(new Set());
  }, [selectedDomainId]);

  // Reset tags when project changes
  useEffect(() => {
    setSelectedTags(new Set());
  }, [selectedProjectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (selectedDomainId) params.domain_id = selectedDomainId;
      if (selectedProjectId) params.project_id = selectedProjectId;
      const [tasksRes, domainsRes] = await Promise.all([
        api.listTasks(Object.keys(params).length > 0 ? params : undefined),
        api.listDomains(),
      ]);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      const domainList = Array.isArray(domainsRes) ? domainsRes : [];
      setDomains(domainList);
      if (domainList.length === 0 && !onboardingDismissed) {
        setShowOnboarding(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedDomainId, selectedProjectId, onboardingDismissed]);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const items = await api.listInbox();
      setInboxItems(Array.isArray(items) ? items : []);
    } catch {
      // Silently fail — inbox is supplementary
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // Auto-refresh inbox every 10 seconds to show processing updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadInbox();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  // Inbox handlers
  const handlePromote = useCallback(async (id: string) => {
    try {
      const domainId = selectedDomainId || (domains.length > 0 ? domains[0].id : undefined);
      await api.promoteInboxItem(id, {
        ...(domainId ? { domain_id: domainId } : {}),
      });
      // Refresh both inbox and tasks
      await Promise.all([loadInbox(), loadData()]);
    } catch {
      // Error handling could be improved
    }
  }, [selectedDomainId, domains, loadInbox, loadData]);

  const handleReject = useCallback(async (id: string) => {
    try {
      await api.updateInboxItem(id, { status: 'rejected' } as Partial<InboxItem>);
      await loadInbox();
    } catch {
      // Silently fail
    }
  }, [loadInbox]);

  // Collect unique tags from all fetched tasks
  const allTags = [...new Set(tasks.flatMap(t => t.tags || []))].sort();

  // Client-side tag filtering
  const filteredTasks = selectedTags.size > 0
    ? tasks.filter(t => t.tags?.some(tag => selectedTags.has(tag)))
    : tasks;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const activeTasks = filteredTasks.filter(t => t.status === 'in_progress' || t.status === 'blocked');
  const inProgressTasks = activeTasks.filter(t => t.status === 'in_progress');
  const blockedTasks = activeTasks.filter(t => t.status === 'blocked');
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'cancelled');

  // Group active tasks by project for display
  const activeByProject = useMemo(() => {
    const allActive = [...inProgressTasks, ...blockedTasks];
    const groups = new Map<string, { label: string | null; tasks: typeof allActive }>();
    for (const task of allActive) {
      const key = task.project_id || '__none__';
      if (!groups.has(key)) {
        groups.set(key, {
          label: task.project?.name ?? (task.project_id ? task.project_id : null),
          tasks: [],
        });
      }
      groups.get(key)!.tasks.push(task);
    }
    const named = [...groups.entries()].filter(([k]) => k !== '__none__').sort(([, a], [, b]) => (a.label ?? '').localeCompare(b.label ?? ''));
    const none = [...groups.entries()].filter(([k]) => k === '__none__');
    return [...named, ...none].map(([, v]) => v);
  }, [inProgressTasks, blockedTasks]);

  // Group pending tasks by project
  const pendingByProject = useMemo(() => {
    const groups = new Map<string, { label: string | null; tasks: typeof pendingTasks }>();
    for (const task of pendingTasks) {
      const key = task.project_id || '__none__';
      if (!groups.has(key)) {
        groups.set(key, {
          label: task.project?.name ?? (task.project_id ? task.project_id : null),
          tasks: [],
        });
      }
      groups.get(key)!.tasks.push(task);
    }
    const named = [...groups.entries()].filter(([k]) => k !== '__none__').sort(([, a], [, b]) => (a.label ?? '').localeCompare(b.label ?? ''));
    const none = [...groups.entries()].filter(([k]) => k === '__none__');
    return [...named, ...none].map(([, v]) => v);
  }, [pendingTasks]);

  // Track collapsed project groups in queue
  const [collapsedQueueGroups, setCollapsedQueueGroups] = useState<Set<string>>(new Set());
  const toggleQueueGroup = (label: string) => {
    setCollapsedQueueGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) { next.delete(label); } else { next.add(label); }
      return next;
    });
  };

  // Count active inbox items for mobile tab badge
  const activeInboxCount = inboxItems.filter(i =>
    i.status === 'unprocessed' || i.status === 'processing' || i.status === 'parsed' || i.status === 'error'
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Mobile pane toggle — shown only on small screens */}
      <div className="md:hidden border-b border-[#2a2a2a] flex shrink-0">
        <button
          onClick={() => setMobilePane('inbox')}
          className={`flex-1 py-2.5 text-center text-[10px] font-mono uppercase tracking-widest transition-colors cursor-pointer ${
            mobilePane === 'inbox'
              ? 'text-[#f0f0f0] border-b-2 border-[#f0f0f0]'
              : 'text-[#4a4a4a] hover:text-[#8a8a8a]'
          }`}
        >
          Inbox{activeInboxCount > 0 ? ` (${activeInboxCount})` : ''}
        </button>
        <button
          onClick={() => setMobilePane('tasks')}
          className={`flex-1 py-2.5 text-center text-[10px] font-mono uppercase tracking-widest transition-colors cursor-pointer ${
            mobilePane === 'tasks'
              ? 'text-[#f0f0f0] border-b-2 border-[#f0f0f0]'
              : 'text-[#4a4a4a] hover:text-[#8a8a8a]'
          }`}
        >
          Tasks{filteredTasks.length > 0 ? ` (${filteredTasks.length})` : ''}
        </button>
      </div>

      {/* Dual-pane container */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE — Inbox */}
        <div className={`w-full md:w-[38%] lg:w-[35%] border-r border-[#2a2a2a] bg-[#0a0a0a] flex-shrink-0 overflow-hidden ${
          mobilePane === 'inbox' ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        }`}>
          <InboxPanel
            items={inboxItems}
            loading={inboxLoading}
            onPromote={handlePromote}
            onReject={handleReject}
            onRefresh={loadInbox}
            defaultDomainId={selectedDomainId || undefined}
          />
        </div>

        {/* RIGHT PANE — Tasks */}
        <div className={`flex-1 flex flex-col overflow-hidden ${
          mobilePane === 'tasks' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Top bar */}
          <div className="border-b border-[#2a2a2a] px-4 md:px-6 py-3 flex flex-col gap-2 shrink-0">
            {/* Domain tabs row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto min-w-0">
                <button
                  onClick={() => setSelectedDomainId('')}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    selectedDomainId === ''
                      ? 'bg-[#f0f0f0] text-[#0a0a0a] font-bold'
                      : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
                  }`}
                >
                  All {filteredTasks.length > 0 && `(${filteredTasks.length})`}
                </button>
                {domains.map(d => {
                  const domainCount = filteredTasks.filter(t => t.domain_id === d.id).length;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDomainId(d.id)}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                        selectedDomainId === d.id
                          ? 'bg-[#f0f0f0] text-[#0a0a0a] font-bold'
                          : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
                      }`}
                    >
                      {d.name}{domainCount > 0 ? ` (${domainCount})` : ''}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowNewTask(true)}
                className="bg-[#f0f0f0] text-[#0a0a0a] px-4 py-1.5 rounded text-xs font-mono font-bold hover:bg-white transition-colors cursor-pointer shrink-0"
              >
                + New Task
              </button>
            </div>

            {/* Project filter row */}
            {(projects.length > 0 || selectedDomainId) && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {projects.length > 0 && (
                  <button
                    onClick={() => setSelectedProjectId('')}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap border ${
                      selectedProjectId === ''
                        ? 'bg-[#2a2a2a] text-[#f0f0f0] border-[#3a3a3a]'
                        : 'bg-[#1a1a1a] text-[#8a8a8a] border-[#2a2a2a] hover:text-[#c0c0c0] hover:border-[#3a3a3a]'
                    }`}
                  >
                    All Projects
                  </button>
                )}
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap border ${
                      selectedProjectId === p.id
                        ? 'bg-[#2a2a2a] text-[#f0f0f0] border-[#3a3a3a]'
                        : 'bg-[#1a1a1a] text-[#8a8a8a] border-[#2a2a2a] hover:text-[#c0c0c0] hover:border-[#3a3a3a]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
                {selectedDomainId && (
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="px-2 py-1 rounded text-[11px] font-mono text-[#6a6a6a] hover:text-[#f0f0f0] border border-dashed border-[#2a2a2a] hover:border-[#4a4a4a] transition-colors cursor-pointer"
                    title="Create project"
                  >
                    +
                  </button>
                )}
              </div>
            )}

            {/* Tag filter row */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer whitespace-nowrap border ${
                      selectedTags.has(tag)
                        ? 'bg-purple-900/30 text-purple-400 border-purple-800/40'
                        : 'text-[#6a6a6a] border-[#2a2a2a] hover:text-[#9a9a9a] hover:border-[#3a3a3a]'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task content */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
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
              <div className="space-y-8">

                {/* ACTIVE ZONE */}
                <div>
                  <div className="flex items-center gap-6 mb-4">
                    {inProgressTasks.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                        <span className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-widest">
                          ACTIVE &middot; {inProgressTasks.length} {inProgressTasks.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    )}
                    {blockedTasks.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                        <span className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-widest">
                          BLOCKED &middot; {blockedTasks.length} {blockedTasks.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    )}
                    {activeTasks.length === 0 && (
                      <span className="text-[10px] font-mono text-[#4a4a4a] uppercase tracking-widest">
                        ACTIVE &middot; no items
                      </span>
                    )}
                  </div>

                  {activeTasks.length === 0 ? (
                    <div className="border border-dashed border-[#222] rounded-lg p-8 text-center">
                      <span className="text-[#4a4a4a] text-xs font-mono">No active work right now</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeByProject.map((group, gi) => (
                        <div key={gi}>
                          {group.label && (
                            <div className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest mb-2">
                              {group.label}
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {group.tasks.map(task => (
                              task.status === 'blocked' ? (
                                <div key={task.id} className="relative">
                                  <div className="absolute inset-0 rounded-lg border border-red-900/50 pointer-events-none z-10" />
                                  <TaskCard
                                    task={task}
                                    onClick={() => setSelectedTaskId(task.id)}
                                  />
                                </div>
                              ) : (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  onClick={() => setSelectedTaskId(task.id)}
                                />
                              )
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* QUEUE ZONE */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-widest">
                      QUEUE &middot; {pendingTasks.length} {pendingTasks.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {pendingTasks.length === 0 ? (
                    <div className="border border-dashed border-[#1a1a1a] rounded-lg p-4 text-center">
                      <span className="text-[#3a3a3a] text-xs font-mono">Queue is empty</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingByProject.map((group, gi) => {
                        const groupKey = group.label ?? '__none__';
                        const isCollapsed = collapsedQueueGroups.has(groupKey);
                        const headerLabel = group.label ?? 'No Project';
                        return (
                          <div key={gi} className="border border-[#1e1e1e] rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleQueueGroup(groupKey)}
                              className="w-full flex items-center justify-between px-4 py-2 bg-[#111] hover:bg-[#161616] transition-colors cursor-pointer"
                            >
                              <span className="text-[10px] font-mono text-[#6a6a6a] uppercase tracking-widest">
                                {isCollapsed ? '\u25B6' : '\u25BC'} {headerLabel}
                              </span>
                              <span className="text-[10px] font-mono text-[#4a4a4a]">{group.tasks.length}</span>
                            </button>
                            {!isCollapsed && group.tasks.map((task) => (
                              <button
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#141414] transition-colors cursor-pointer border-t border-[#1e1e1e] group/qitem`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: ({ low: '#22c55e', medium: '#eab308', high: '#f97316', urgent: '#ef4444' } as Record<string,string>)[task.priority] || '#4a4a4a' }}
                                  />
                                  <span className="text-sm text-[#d8d8d8] truncate">{task.title}</span>
                                  {task.current_state && (
                                    <span className="text-xs text-[#6a6a6a] truncate hidden md:block">
                                      — {task.current_state}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-[#4a4a4a] shrink-0 ml-3">
                                  {task.assignee || task.claimed_by || '\u2014'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(task.id);
                                  }}
                                  className="text-[9px] font-mono text-[#3a3a3a] hover:text-[#8a8a8a] transition-colors cursor-pointer shrink-0 ml-2 opacity-0 group-hover/qitem:opacity-100"
                                  title={task.id}
                                >
                                  ID
                                </button>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* COMPLETED ZONE */}
                {completedTasks.length > 0 && (
                  <div>
                    <button
                      onClick={() => setCompletedCollapsed(v => !v)}
                      className="flex items-center gap-2 mb-3 cursor-pointer group"
                    >
                      <span className="text-[10px] font-mono text-[#3a3a3a] uppercase tracking-widest group-hover:text-[#5a5a5a] transition-colors">
                        {completedCollapsed ? '\u25B6' : '\u25BC'} DONE &middot; {completedTasks.length} {completedTasks.length === 1 ? 'item' : 'items'}
                      </span>
                    </button>

                    {!completedCollapsed && (
                      <div className="border border-[#181818] rounded-lg overflow-hidden opacity-50">
                        {completedTasks.map((task, idx) => (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#111] transition-colors cursor-pointer ${
                              idx < completedTasks.length - 1 ? 'border-b border-[#181818]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2a2a2a] shrink-0" />
                              <span className="text-sm text-[#6a6a6a] truncate line-through">{task.title}</span>
                            </div>
                            <span className="text-[10px] font-mono text-[#3a3a3a] shrink-0 ml-3 uppercase">
                              {task.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
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

      {/* Onboarding overlay */}
      {showOnboarding && (
        <Onboarding
          onDismiss={() => {
            setShowOnboarding(false);
            setOnboardingDismissed(true);
            localStorage.setItem('tfa_onboarding_done', 'true');
            loadData();
          }}
        />
      )}
      {showNewProject && (
        <NewProject
          onClose={() => setShowNewProject(false)}
          onCreated={() => {
            const domId = selectedDomainId || undefined;
            api.listProjects(domId).then(setProjects).catch(() => {});
          }}
          defaultDomainId={selectedDomainId || undefined}
        />
      )}
    </div>
  );
}
