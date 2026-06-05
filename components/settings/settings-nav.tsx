"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAdjustments, IconMessage, IconUsers } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();
  const { can, canAny } = useAuth();

  const tabs = [
    can("settings:general") && {
      href: "/transcribe/settings",
      label: "General",
      icon: IconAdjustments,
      isActive: (p: string) => p === "/transcribe/settings" || p === "/transcribe/settings/",
    },
    can("settings:systemprompt") && {
      href: "/transcribe/settings/prompts",
      label: "Prompts",
      icon: IconMessage,
      isActive: (p: string) => p.startsWith("/transcribe/settings/prompts"),
    },
    canAny(["user:create", "user:permission"]) && {
      href: "/transcribe/settings/users",
      label: "Users",
      icon: IconUsers,
      isActive: (p: string) => p.startsWith("/transcribe/settings/users"),
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: typeof IconAdjustments;
    isActive: (pathname: string) => boolean;
  }[];

  if (tabs.length === 0) return null;

  return (
    <nav className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
      {tabs.map(({ href, label, icon: Icon, isActive }) => {
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
