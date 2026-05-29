"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconDotsVertical,
  IconExternalLink,
  IconFileText,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TranscribeJob } from "@/hooks/use-transcribe-jobs";
import { cn } from "@/lib/utils";

type TranscriptsTableProps = {
  jobs: TranscribeJob[];
  onRefresh: () => void;
};

export function TranscriptsTable({ jobs, onRefresh }: TranscriptsTableProps) {
  const router = useRouter();

  async function handleResume(jobId: string) {
    const res = await fetch(`/api/transcribe/jobs/${jobId}/resume`, { method: "POST" });
    if (res.ok) {
      toast.success("Job resumed");
      onRefresh();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to resume");
    }
  }

  async function handleStop(jobId: string) {
    const res = await fetch(`/api/transcribe/jobs/${jobId}/stop`, { method: "POST" });
    if (res.ok) {
      toast.info("Job stopped");
      onRefresh();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to stop");
    }
  }

  return (
    <div className="glass-card overflow-hidden rounded-xl ring-1 ring-border/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-[35%]">File</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[20%]">Progress</TableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const progressPct =
              job.totalChunks > 0
                ? Math.round((job.completedChunks / job.totalChunks) * 100)
                : job.status === "completed"
                  ? 100
                  : 0;
            const isActive = ["pending", "chunking", "processing"].includes(job.status);
            const canOpen = job.status === "completed";

            return (
              <TableRow
                key={job.id}
                className={cn(
                  "border-border/30 transition-colors",
                  canOpen && "cursor-pointer hover:bg-primary/5",
                )}
                onClick={() => {
                  if (canOpen) router.push(`/transcribe/${job.id}`);
                }}
              >
                <TableCell className="font-mono text-xs max-w-0">
                  <span className="block truncate" title={job.filename}>
                    {job.filename}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[0.65rem] font-normal">
                    {job.model.split("/").pop()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={job.status} />
                    {job.error && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="line-clamp-1 text-[0.65rem] text-destructive font-mono">
                            {job.error}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs font-mono text-xs">
                          {job.error}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <Progress
                      value={progressPct}
                      className={cn("h-1.5", isActive && "animate-pulse")}
                    />
                    <span className="text-[0.65rem] tabular-nums text-muted-foreground">
                      {job.totalChunks > 0
                        ? `${job.completedChunks}/${job.totalChunks}`
                        : isActive
                          ? "Starting…"
                          : "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <IconDotsVertical className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canOpen && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href={`/transcribe/${job.id}`}>
                              <IconPlayerPlay className="size-3.5" />
                              Open player
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/api/transcribe/jobs/${job.id}/result`}>
                              <IconFileText className="size-3.5" />
                              Download Markdown
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {["failed", "stopped"].includes(job.status) && (
                        <DropdownMenuItem onClick={() => handleResume(job.id)}>
                          <IconRefresh className="size-3.5" />
                          Resume
                        </DropdownMenuItem>
                      )}
                      {isActive && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleStop(job.id)}
                        >
                          <IconPlayerStop className="size-3.5" />
                          Stop
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <a
                          href={`/api/transcribe/jobs/${job.id}/transcript`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <IconExternalLink className="size-3.5" />
                          View JSON
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
