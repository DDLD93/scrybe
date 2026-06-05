"use client";

import { useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { FileMetadataRow } from "@/components/transcribe/file-metadata-row";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCreatedDateTime } from "@/lib/format-relative-time";
import { formatDuration, formatFileSize } from "@/lib/transcribe/file-metadata";
import { cn } from "@/lib/utils";

export type JobDetailsData = {
  createdAt?: string | null;
  folderName?: string | null;
  jobKind?: string | null;
  model?: string | null;
  hasWordTimings?: boolean;
  durationSec?: number | string | null;
  transcriptDuration?: number | null;
  fileSize?: number | null;
  language?: string | null;
  contentType?: string | null;
};

type JobDetailsPanelProps = {
  job: JobDetailsData | null;
  loading?: boolean;
};

function formatOptional(
  value: string | number | null | undefined,
  formatter?: (v: number) => string,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (formatter && typeof value === "number") return formatter(value);
  return String(value);
}

function resolveDuration(job: JobDetailsData): string {
  const raw = job.durationSec ?? job.transcriptDuration;
  if (raw === null || raw === undefined || raw === "") return "—";
  const sec = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(sec) || sec < 0) return "—";
  return formatDuration(sec);
}

function formatJobKind(kind: string | null | undefined): string {
  if (!kind || kind === "audio") return "Audio";
  if (kind === "pdf") return "PDF";
  return kind;
}

function formatModel(model: string | null | undefined): {
  display: string;
  full: string;
} {
  if (!model) return { display: "—", full: "—" };
  const short = model.split("/").pop() ?? model;
  return { display: short, full: model };
}

export function JobDetailsPanel({ job, loading }: JobDetailsPanelProps) {
  const [open, setOpen] = useState(false);

  if (loading) return null;
  if (!job) return null;

  const model = formatModel(job.model);
  const showModelTooltip = model.display !== model.full && model.display !== "—";

  return (
    <div className="shrink-0 border-b border-border/40 pb-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-0 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <IconChevronDown className="size-3.5" />
        ) : (
          <IconChevronRight className="size-3.5" />
        )}
        File details
      </Button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="glass-card mt-2 space-y-2 rounded-lg p-3 ring-1 ring-border/50">
            <FileMetadataRow
              label="Created"
              value={formatCreatedDateTime(job.createdAt)}
            />
            <FileMetadataRow
              label="Folder"
              value={job.folderName ?? "Uncategorized"}
            />
            <FileMetadataRow label="Type" value={formatJobKind(job.jobKind)} />
            {showModelTooltip ? (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">Model</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default font-mono font-medium text-foreground">
                      {model.display}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono text-xs">
                    {model.full}
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <FileMetadataRow label="Model" value={model.display} />
            )}
            <FileMetadataRow
              label="Word timing"
              value={job.hasWordTimings ? "Yes" : "No"}
            />
            <FileMetadataRow label="Duration" value={resolveDuration(job)} />
            <FileMetadataRow
              label="Size"
              value={
                job.fileSize != null && job.fileSize > 0
                  ? formatFileSize(job.fileSize)
                  : "—"
              }
            />
            <FileMetadataRow label="Language" value={formatOptional(job.language)} />
            <FileMetadataRow label="Format" value={formatOptional(job.contentType)} />
          </div>
        </div>
      </div>
    </div>
  );
}
