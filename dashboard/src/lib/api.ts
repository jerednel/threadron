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
  created_at: string;
  updated_at: string;
}

export interface ContextEntry {
  id: string;
  task_id: string;
  type: string;
  body: string;
  author: string;
  created_at: string;
}

export interface TaskDetail extends Task {
  context?: ContextEntry[];
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
  listDomains: (): Promise<Domain[]> => request('/domains'),
  createDomain: (data: { name: string; default_guardrail: string }): Promise<Domain> =>
    request('/domains', { method: 'POST', body: JSON.stringify(data) }),
  deleteDomain: (id: string) => request(`/domains/${id}`, { method: 'DELETE' }),

  // Projects
  listProjects: (domainId?: string): Promise<Project[]> =>
    request(`/projects${domainId ? `?domain_id=${domainId}` : ''}`),
  createProject: (data: { name: string; domain_id: string; description?: string }): Promise<Project> =>
    request('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Tasks
  listTasks: (params?: Record<string, string>): Promise<Task[]> => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/tasks${qs}`);
  },
  getTask: (id: string): Promise<TaskDetail> => request(`/tasks/${id}`),
  createTask: (data: Partial<Task> & { title: string }): Promise<Task> =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>): Promise<Task> =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Context
  addContext: (taskId: string, data: { type: string; body: string; author: string }): Promise<ContextEntry> =>
    request(`/tasks/${taskId}/context`, { method: 'POST', body: JSON.stringify(data) }),

  // Agents
  listAgents: (): Promise<Agent[]> => request('/agents'),

  // Config
  getConfig: () => request('/config'),
  setConfig: (key: string, value: unknown) =>
    request('/config', { method: 'POST', body: JSON.stringify({ key, value }) }),

  // Auth keys
  listApiKeys: () => request('/auth/keys'),
};
