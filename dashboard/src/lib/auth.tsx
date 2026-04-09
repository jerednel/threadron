import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setAuth, clearAuth, type User } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ api_key?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tfa_token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify existing token
  useEffect(() => {
    const existingToken = localStorage.getItem('tfa_token');
    if (existingToken) {
      setAuth(existingToken);
      api.me()
        .then((data) => {
          setUser(data.user || data);
          setToken(existingToken);
        })
        .catch(() => {
          clearAuth();
          setUser(null);
          setToken(null);
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
    setAuth(res.token);
    setToken(res.token);
    setUser(res.user || null);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.register({ email, password, name });
    if (res.error) throw new Error(res.error);
    if (!res.token) throw new Error('Registration failed');
    setAuth(res.token);
    setToken(res.token);
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
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
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
