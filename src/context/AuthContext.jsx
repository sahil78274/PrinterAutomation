import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest } from '../services/api.js';

const STORAGE_KEY = 'smartprint.session.v1';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch {
        /* storage unavailable — session stays in memory */
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const login = useCallback(async (credentials) => {
    const result = await loginRequest(credentials);
    setSession(result);
    return result;
  }, []);

  const logout = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      role: session?.user?.role ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session),
      booting,
      setBooting,
      login,
      logout,
      isShopOwner: session?.user?.role === 'owner' || session?.user?.role === 'shop',
      isAdmin: session?.user?.role === 'admin',
    }),
    [session, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
