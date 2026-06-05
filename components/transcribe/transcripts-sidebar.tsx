"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { IconSearch, IconSettings } from "@tabler/icons-react";
import { TRANSCRIBE_JOB_PATH } from "@/lib/detect-file-kind";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranscribeJobs } from "@/hooks/use-transcribe-jobs";
import { cn } from "@/lib/utils";

export function TranscriptsSidebar() {
  const pathname = usePathname();
  const activeId = pathname.match(TRANSCRIBE_JOB_PATH)?.[1];
  const [query, setQuery] = useState("");
  const { jobs, loading } = useTranscribeJobs(2000);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => j.filename.toLowerCase().includes(q));
  }, [jobs, query]);

  return (
    <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border/40 bg-card/20">
      <div className="border-b border-border/40 p-3">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">No transcripts yet</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((job) => {
              const active = job.id === activeId;
              const canOpen = job.status === "completed";
              return (
                <li key={job.id}>
                  <Link
                    href={canOpen ? `/transcribe/${job.id}` : "/transcribe"}
                    className={cn(
                      "block rounded-lg px-2.5 py-2 transition-colors",
                      active
                        ? "bg-primary/15 ring-1 ring-primary/25"
                        : "hover:bg-muted/50",
                      !canOpen && "opacity-70",
                    )}
                  >
                    <p className="truncate text-xs font-medium text-foreground">{job.filename}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <StatusBadge status={job.status} />
                      {job.status === "processing" && job.totalChunks > 0 && (
                        <span className="text-[0.6rem] text-muted-foreground">
                          {job.completedChunks}/{job.totalChunks}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <div className="border-t border-border/40 p-2">
        <Link
          href="/transcribe/settings"
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
            pathname === "/transcribe/settings" && "bg-muted/50 text-foreground",
          )}
        >
          <IconSettings className="size-3.5" />
          System prompts
        </Link>
      </div>
    </aside>
  );
}
