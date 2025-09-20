import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginRequest } from '../api/auth';
import { setAuthToken } from '../api/client';
import type { LoginCredentials, LoginResponse, User } from '../types';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'camera_dashboard_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => {
    const persisted = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!persisted) return null;
    try {
      const parsed: LoginResponse = JSON.parse(persisted);
      return parsed.token;
    } catch (error) {
      console.error('Failed to parse auth state', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    const persisted = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!persisted) return null;
    try {
      const parsed: LoginResponse = JSON.parse(persisted);
      return parsed.user;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginRequest(credentials);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response));
    setAuthToken(response.token);
    navigate('/', { replace: true });
  }, [navigate]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isAuthenticated: Boolean(token),
    login,
    logout
  }), [login, logout, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
