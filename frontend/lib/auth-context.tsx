import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as api from './api';

export type Role = 'ADMIN' | 'AGENT' | 'QUALIFIER' | 'FIELD_SALES';

export interface User {
  id: string;
  fullName: string;
  username: string;
  /** e.g. JohnD — from backend */
  usernameDisplay?: string;
  email?: string | null;
  role: Role;
  /** Rattle / Leadwise sheet pipeline */
  specialSheetQualifier?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, role?: Role) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  error: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('margav_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('margav_user');
      localStorage.removeItem('margav_token');
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('margav_token');
    const stored = localStorage.getItem('margav_user');
    if (!token || !stored) {
      setLoading(false);
      return;
    }
    api.getMe()
      .then((me) => {
        setUser({
          id: me.id,
          fullName: me.fullName,
          username: (me as { username: string }).username,
          usernameDisplay: (me as { usernameDisplay?: string }).usernameDisplay,
          email: (me as { email?: string | null }).email,
          role: me.role as Role,
          specialSheetQualifier: (me as { specialSheetQualifier?: boolean }).specialSheetQualifier,
        });
      })
      .catch(() => {
        localStorage.removeItem('margav_token');
        localStorage.removeItem('margav_user');
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(async (username: string, password: string, role?: Role) => {
    setError(null);
    try {
      const { user: u, token } = await api.login(username, password);
      localStorage.setItem('margav_token', token);
      setUser({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        usernameDisplay: u.usernameDisplay,
        email: u.email,
        role: (role ?? u.role) as Role,
        specialSheetQualifier: u.specialSheetQualifier,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  }, [setUser]);

  const logout = useCallback(() => {
    setUser(null);
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
