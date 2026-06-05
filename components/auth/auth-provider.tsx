"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UserPermission, UserStatus } from "@/lib/db/schema";
import { canAccessSettings, hasAnyPermission, hasPermission } from "@/lib/auth/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  permissions: UserPermission[];
  status: UserStatus;
  mustChangePassword: boolean;
};

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: UserPermission) => boolean;
  canAny: (permissions: UserPermission[]) => boolean;
  canAccessSettings: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }

  const value: AuthContextValue = {
    user,
    loading,
    refresh,
    logout,
    can: (permission) => hasPermission(user?.permissions, permission),
    canAny: (permissions) => hasAnyPermission(user?.permissions, permissions),
    canAccessSettings: canAccessSettings(user?.permissions),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
