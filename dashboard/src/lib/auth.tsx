import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setAuth, clearAuth, type User } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ api_key: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tfa_token'));
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('tfa_api_key'));
  const [loading, setLoading] = useState(true);

  // On mount, verify existing token
  useEffect(() => {
    const existingToken = localStorage.getItem('tfa_token');
    const existingKey = localStorage.getItem('tfa_api_key');
    if (existingToken && existingKey) {
      api.me()
        .then((u: User) => {
          setUser(u);
          setToken(existingToken);
          setApiKey(existingKey);
        })
        .catch(() => {
          clearAuth();
          setUser(null);
          setToken(null);
          setApiKey(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    if (res.error) throw new Error(res.error);
    if (!res.token) throw new Error('Login failed');
    // After login we have a JWT token but need the api_key from storage or user lookup
    // Store token, then fetch user
    const k = res.api_key || localStorage.getItem('tfa_api_key') || res.token;
    setAuth(res.token, k);
    setToken(res.token);
    setApiKey(k);
    setUser(res.user || null);
    // Fetch full user if not included
    if (!res.user) {
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        // ignore
      }
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.register({ email, password, name });
    if (res.error) throw new Error(res.error);
    if (!res.token) throw new Error('Registration failed');
    setAuth(res.token, res.api_key || res.token);
    setToken(res.token);
    setApiKey(res.api_key || res.token);
    setUser(res.user || null);
    // Store the initial API key so the onboarding flow can display it once
    if (res.api_key) {
      localStorage.setItem('tfa_initial_api_key', res.api_key);
    }
    return { api_key: res.api_key };
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setToken(null);
    setApiKey(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      apiKey,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
