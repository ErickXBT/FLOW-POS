import { useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "flow_token";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "super_admin" | "owner" | "manager" | "cashier" | "staff";
  tenantId: number | null;
  createdAt: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Register auth token getter on module load
setAuthTokenGetter(() => getStoredToken());

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setStoredToken(null);
      }
    } catch {
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = useCallback((token: string, userData: AuthUser) => {
    setStoredToken(token);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  return { user, loading, login, logout, refetch: loadUser };
}
