"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/layout/app-shell";

const AUTH_PATHS = new Set(["/login", "/setup", "/change-password"]);

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { refresh } = useAuth();
  const prevPath = useRef(pathname);
  const isAuthPage = AUTH_PATHS.has(pathname);

  useEffect(() => {
    const wasAuthPage = AUTH_PATHS.has(prevPath.current);
    prevPath.current = pathname;
    if (wasAuthPage && !isAuthPage) {
      void refresh();
    }
  }, [pathname, isAuthPage, refresh]);

  return isAuthPage ? children : <AppShell>{children}</AppShell>;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AuthProvider>
  );
}
