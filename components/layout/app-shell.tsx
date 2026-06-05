"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBooks, IconLogout, IconSettings } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { TRANSCRIBE_JOB_PATH } from "@/lib/detect-file-kind";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useBrand } from "@/components/brand/brand-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  {
    href: "/transcribe",
    label: "Library",
    icon: IconBooks,
    isActive: (pathname: string) =>
      pathname.startsWith("/transcribe") && !pathname.startsWith("/transcribe/settings"),
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onJobPage = TRANSCRIBE_JOB_PATH.test(pathname);
  const { user, loading, logout, canAccessSettings, can } = useAuth();
  const { tagline } = useBrand();

  const navItems = [
    ...NAV_ITEMS,
    ...(canAccessSettings
      ? [
          {
            href: "/transcribe/settings",
            label: "Settings",
            icon: IconSettings,
            isActive: (p: string) => p.startsWith("/transcribe/settings"),
          },
        ]
      : []),
  ];

  return (
    <div className="ambient-bg relative flex min-h-screen">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2 border-b border-border/40 px-5">
          <BrandLogo size="sm" nameClassName="flex-1" className="min-w-0 flex-1" />
          <ThemeToggle />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-primary/15 text-primary shadow-[0_0_20px_-5px] shadow-primary/40 ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/40 p-4 space-y-3">
          {!loading && user && (
            <div className="space-y-2">
              <div>
                <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
                <p className="truncate text-[0.65rem] text-muted-foreground">{user.email}</p>
              </div>
              {can("file:all") && (
                <Badge variant="secondary" className="text-[0.6rem]">
                  All files
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start gap-2 px-2 text-xs text-muted-foreground"
                onClick={() => void logout()}
              >
                <IconLogout className="size-3.5" />
                Sign out
              </Button>
            </div>
          )}
          <p className="text-[0.65rem] text-muted-foreground">{tagline}</p>
        </div>
      </aside>

      <div className={cn("flex min-h-screen flex-1 flex-col", !onJobPage && "pb-16 md:pb-0")}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-card/30 px-4 backdrop-blur-xl md:hidden">
          <BrandLogo size="sm" />
          <ThemeToggle />
        </header>
        <main className={cn("flex-1", onJobPage ? "p-0 md:p-0" : "p-4 md:p-6")}>{children}</main>
      </div>

      {!onJobPage && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/40 bg-card/80 backdrop-blur-xl md:hidden">
          {navItems.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[0.65rem] transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", active && "drop-shadow-[0_0_8px] drop-shadow-primary/60")}
                />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
