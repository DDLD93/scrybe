"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/layout/app-shell";

const AUTH_PATHS = new Set(["/login", "/setup", "/change-password"]);

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.has(pathname);

  return (
    <AuthProvider>
      {isAuthPage ? children : <AppShell>{children}</AppShell>}
    </AuthProvider>
  );
}
