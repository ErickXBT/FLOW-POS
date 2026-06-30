import { useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "flow_token";
const ADMIN_TOKEN_KEY = "admin_token";

export type UserRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "cashier"
  | "kitchen_staff"
  | "delivery_staff"
  | "staff";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  tenantId: number | null;
  avatarUrl?: string | null;
  createdAt: string;
  permissions?: string[];
  branchId?: number | null;
  branchName?: string | null;
  businessType?: string;
  businessEngine?: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Role-based permission helpers
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  owner: "Pemilik",
  manager: "Manager",
  cashier: "Kasir",
  kitchen_staff: "Staff Dapur",
  delivery_staff: "Kurir",
  staff: "Staff",
};

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "owner") return true;
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(permission);
  }

  const perms: Record<string, UserRole[]> = {
    view_dashboard: ["owner", "manager", "super_admin"],
    view_reports: ["owner", "manager", "super_admin"],
    manage_employees: ["owner", "manager", "super_admin"],
    manage_products: ["owner", "manager", "super_admin"],
    manage_inventory: ["owner", "manager", "super_admin"],
    view_customers: ["owner", "manager", "cashier", "super_admin"],
    manage_orders: ["owner", "manager", "cashier", "super_admin"],
    view_pos: ["owner", "manager", "cashier", "staff", "super_admin"],
    view_kitchen: ["owner", "manager", "kitchen_staff"],
    view_delivery: ["owner", "manager", "delivery_staff"],
    manage_settings: ["owner", "super_admin"],
    manage_qr_menu: ["owner", "super_admin"],
    view_activity_logs: ["owner", "manager", "super_admin"],
    view_sessions: ["owner", "manager", "super_admin"],
    manage_bookings: ["owner", "manager", "cashier", "super_admin"],
    manage_appointments: ["owner", "manager", "cashier", "staff", "super_admin"],
    manage_services: ["owner", "manager", "super_admin"],
    manage_work_orders: ["owner", "manager", "cashier", "staff", "super_admin"],
  };
  return (perms[permission] ?? []).includes(user.role);
}

// Register auth token getter on module load
setAuthTokenGetter(() => getStoredToken());

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        if (res.status === 401 || res.status === 403) {
          setStoredToken(null);
          setUser(null);
        }
      }
    } catch {
      // Keep token on network/offline errors to avoid auto-logout
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
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setUser(null);
  }, []);

  const impersonate = useCallback((token: string, userData: AuthUser) => {
    const currentToken = getStoredToken();
    if (currentToken) {
      localStorage.setItem(ADMIN_TOKEN_KEY, currentToken);
    }
    setStoredToken(token);
    setUser(userData);
  }, []);

  const exitImpersonate = useCallback(async () => {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (adminToken) {
      setStoredToken(adminToken);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setLoading(true);
      await loadUser();
    }
  }, [loadUser]);

  const isImpersonating = !!localStorage.getItem(ADMIN_TOKEN_KEY);

  return {
    user,
    loading,
    login,
    logout,
    impersonate,
    exitImpersonate,
    isImpersonating,
    refetch: loadUser
  };
}
