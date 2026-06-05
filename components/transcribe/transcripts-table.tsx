"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  IconDotsVertical,
  IconExternalLink,
  IconFileText,
  IconHighlight,
  IconPencil,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DeleteJobDialog } from "@/components/transcribe/delete-job-dialog";
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
  onEditJob?: (job: TranscribeJob) => void;
};

export function TranscriptsTable({ jobs, onRefresh, onEditJob }: TranscriptsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<TranscribeJob | null>(null);

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

  async function confirmDelete() {
    if (!jobToDelete) return;

    setDeletingId(jobToDelete.id);
    try {
      const res = await fetch(`/api/transcribe/jobs/${jobToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Job deleted");
        setJobToDelete(null);
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
    <DeleteJobDialog
      job={jobToDelete}
      deleting={deletingId !== null}
      onOpenChange={(open) => {
        if (!open && deletingId === null) setJobToDelete(null);
      }}
      onConfirm={confirmDelete}
    />
    <div className="glass-card overflow-hidden rounded-xl ring-1 ring-border/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="w-[28%]">File</TableHead>
            <TableHead className="w-[12%]">Folder</TableHead>
            <TableHead className="w-24">Word timing</TableHead>
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

            function openPlayer() {
              if (canOpen) router.push(`/transcribe/${job.id}`);
            }

            return (
              <TableRow
                key={job.id}
                className={cn(
                  "border-border/30 transition-colors",
                  canOpen && "cursor-pointer hover:bg-primary/5",
                )}
                tabIndex={canOpen ? 0 : undefined}
                role={canOpen ? "button" : undefined}
                title={canOpen ? "Open player" : undefined}
                onClick={openPlayer}
                onKeyDown={(e) => {
                  if (canOpen && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    openPlayer();
                  }
                }}
              >
                <TableCell className="font-mono text-xs max-w-0">
                  <span className="flex items-center gap-1.5 truncate" title={job.filename}>
                    <span className="truncate">{job.filename}</span>
                    {job.jobKind === "pdf" && (
                      <Badge variant="outline" className="shrink-0 text-[0.6rem]">
                        PDF
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {job.folderName ?? "—"}
                </TableCell>
                <TableCell>
                  {job.hasWordTimings ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="gap-1 font-normal text-primary"
                        >
                          <IconHighlight className="size-3" />
                          Yes
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Word highlight during playback
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-[0.65rem] text-muted-foreground">—</span>
                  )}
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEditJob?.(job)}>
                        <IconPencil className="size-3.5" />
                        Edit / move
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletingId === job.id}
                        onClick={() => setJobToDelete(job)}
                      >
                        <IconTrash className="size-3.5" />
                        Delete job
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
    </>
  );
}
