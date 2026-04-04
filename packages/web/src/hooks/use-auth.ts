import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createElement } from 'react';

const STORAGE_KEY = 'recon-web-token';

interface AuthContextValue {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getStoredToken);

  const setToken = useCallback((t: string) => {
    localStorage.setItem(STORAGE_KEY, t);
    setTokenState(t);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTokenState(null);
  }, []);

  return createElement(
    AuthContext.Provider,
    { value: { token, setToken, clearToken, isAuthenticated: !!token } },
    children,
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
