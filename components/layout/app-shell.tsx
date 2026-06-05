"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBooks, IconSettings } from "@tabler/icons-react";
import { TRANSCRIBE_JOB_PATH } from "@/lib/detect-file-kind";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_ITEMS = [
  {
    href: "/transcribe",
    label: "Library",
    icon: IconBooks,
    isActive: (pathname: string) =>
      pathname.startsWith("/transcribe") && !pathname.startsWith("/transcribe/settings"),
  },
  {
    href: "/transcribe/settings",
    label: "Prompts",
    icon: IconSettings,
    isActive: (pathname: string) => pathname.startsWith("/transcribe/settings"),
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onJobPage = TRANSCRIBE_JOB_PATH.test(pathname);

  return (
    <div className="ambient-bg relative flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2 border-b border-border/40 px-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
            <span className="text-xs font-bold text-primary">S</span>
          </div>
          <span className="flex-1 text-sm font-semibold tracking-tight text-foreground">Scrybe</span>
          <ThemeToggle />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => {
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
        <div className="border-t border-border/40 p-4">
          <p className="text-[0.65rem] text-muted-foreground">
            Process audio, PDF, and media into editable text
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex min-h-screen flex-1 flex-col", !onJobPage && "pb-16 md:pb-0")}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-card/30 px-4 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
              <span className="text-xs font-bold text-primary">S</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">Scrybe</span>
          </div>
          <ThemeToggle />
        </header>
        <main className={cn("flex-1", onJobPage ? "p-0 md:p-0" : "p-4 md:p-6")}>{children}</main>
      </div>

      {/* Mobile bottom nav — hidden on job player for more content space */}
      {!onJobPage && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/40 bg-card/80 backdrop-blur-xl md:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => {
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
