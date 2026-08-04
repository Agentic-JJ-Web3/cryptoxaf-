import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi } from '../api/client';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', operator: null });

  const refresh = useCallback(async () => {
    try {
      const { operator } = await adminApi.me();
      setState({ status: 'authenticated', operator });
    } catch {
      setState({ status: 'unauthenticated', operator: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { operator } = await adminApi.login(email, password);
    setState({ status: 'authenticated', operator });
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } catch {
      // Best-effort — the session cookie may already be gone. Either way
      // the local view goes back to unauthenticated.
    }
    setState({ status: 'unauthenticated', operator: null });
  }, []);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}

export function RequireAdminAuth({ children }) {
  const { status } = useAdminAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading…</div>
    );
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
