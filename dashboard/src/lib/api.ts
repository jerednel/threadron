const BASE = '/v1';

let token: string | null = localStorage.getItem('tfa_token');
let apiKey: string | null = localStorage.getItem('tfa_api_key');

export function setAuth(t: string, k: string) {
  token = t;
  apiKey = k;
  localStorage.setItem('tfa_token', t);
  localStorage.setItem('tfa_api_key', k);
}

export function clearAuth() {
  token = null;
  apiKey = null;
  localStorage.removeItem('tfa_token');
  localStorage.removeItem('tfa_api_key');
}

export function getToken(): string | null {
  return token;
}

export function getApiKey(): string | null {
  return apiKey;
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/dashboard/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || 'Request failed');
  }
  // Handle 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Domain {
  id: string;
  name: string;
  default_guardrail: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  domain_id: string;
  description?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: string;
  domain_id?: string;
  domain?: Domain;
  project_id?: string;
  project?: Project;
  guardrail?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  needs_approval?: boolean;
  // Work item fields
  goal?: string;
  current_state?: string;
  next_action?: string;
  outcome_definition?: string;
  blockers?: string[];
  confidence?: 'low' | 'medium' | 'high';
  claimed_by?: string;
  claimed_until?: string;
  created_at: string;
  updated_at: string;
}

export interface ContextEntry {
  id: string;
  task_id: string;
  type: string;
  body: string;
  author: string;
  actor_type?: 'system' | 'agent' | 'human';
  created_at: string;
}

export interface Artifact {
  id: string;
  task_id: string;
  type: string;
  uri?: string;
  body?: string;
  title?: string;
  created_by: string;
  created_at: string;
}

export interface TaskDetail extends Task {
  context?: ContextEntry[];
  artifacts?: Artifact[];
}

export interface Agent {
  id: string;
  name: string;
  last_seen?: string;
  created_at: string;
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string }) =>
    fetch(`${BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  login: (data: { email: string; password: string }) =>
    fetch(`${BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  me: () => {
    // me uses JWT token for auth
    const t = localStorage.getItem('tfa_token');
    return fetch(`${BASE}/users/me`, {
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
      },
    }).then(async r => {
      if (!r.ok) throw new Error('Not authenticated');
      return r.json();
    });
  },

  // Domains
  listDomains: (): Promise<Domain[]> => request('/domains').then(r => r.domains ?? r),
  createDomain: (data: { name: string; default_guardrail: string }): Promise<Domain> =>
    request('/domains', { method: 'POST', body: JSON.stringify(data) }),
  deleteDomain: (id: string) => request(`/domains/${id}`, { method: 'DELETE' }),

  // Projects
  listProjects: (domainId?: string): Promise<Project[]> =>
    request(`/projects${domainId ? `?domain_id=${domainId}` : ''}`).then(r => r.projects ?? r),
  createProject: (data: { name: string; domain_id: string; description?: string }): Promise<Project> =>
    request('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Tasks
  listTasks: (params?: Record<string, string>): Promise<Task[]> => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/tasks${qs}`).then(r => r.tasks ?? r);
  },
  getTask: (id: string): Promise<TaskDetail> => request(`/tasks/${id}`),
  createTask: (data: Partial<Task> & { title: string; created_by?: string; domain_id?: string; project_id?: string }): Promise<Task> =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>): Promise<Task> =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Context
  addContext: (taskId: string, data: { type: string; body: string; author: string }): Promise<ContextEntry> =>
    request(`/tasks/${taskId}/context`, { method: 'POST', body: JSON.stringify(data) }),

  // Artifacts
  listArtifacts: (taskId: string) => request(`/tasks/${taskId}/artifacts`).then(r => r.artifacts ?? r),
  createArtifact: (taskId: string, data: { type: string; uri?: string; body?: string; title?: string; created_by: string }) =>
    request(`/tasks/${taskId}/artifacts`, { method: 'POST', body: JSON.stringify(data) }),

  // Claims
  claimTask: (taskId: string, data: { agent_id: string; duration_minutes: number }) =>
    request(`/tasks/${taskId}/claim`, { method: 'POST', body: JSON.stringify(data) }),
  releaseTask: (taskId: string) =>
    request(`/tasks/${taskId}/release`, { method: 'POST' }),

  // Agents
  listAgents: (): Promise<Agent[]> => request('/agents').then(r => r.agents ?? r),

  // Config
  getConfig: () => request('/config').then(r => r.config ?? r),
  setConfig: (key: string, value: unknown) =>
    request('/config', { method: 'POST', body: JSON.stringify({ key, value }) }),

  // Auth keys
  createApiKey: (data: { name: string; agent_id?: string }) =>
    request('/auth/keys', { method: 'POST', body: JSON.stringify(data) }),
  listApiKeys: () => request('/auth/keys').then(r => r.keys ?? r),
  revokeApiKey: (id: string) => request(`/auth/keys/${id}`, { method: 'DELETE' }),
};
