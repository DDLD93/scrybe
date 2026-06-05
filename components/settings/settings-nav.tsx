"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAdjustments, IconMessage } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  {
    href: "/transcribe/settings",
    label: "General",
    icon: IconAdjustments,
    isActive: (pathname: string) =>
      pathname === "/transcribe/settings" || pathname === "/transcribe/settings/",
  },
  {
    href: "/transcribe/settings/prompts",
    label: "Prompts",
    icon: IconMessage,
    isActive: (pathname: string) => pathname.startsWith("/transcribe/settings/prompts"),
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
      {SETTINGS_TABS.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
