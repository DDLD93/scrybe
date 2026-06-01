"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  IconChevronRight,
  IconFolder,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import { TranscriptsTable } from "@/components/transcribe/transcripts-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TranscribeJob } from "@/hooks/use-transcribe-jobs";
import {
  filterTranscriptJobs,
  folderLabel,
  jobsInFolder,
  listTranscriptFolders,
  type TranscriptFilters,
} from "@/lib/transcribe/folders";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

type TranscriptsBrowserProps = {
  jobs: TranscribeJob[];
  onRefresh: () => void;
};

const DEFAULT_FILTERS: TranscriptFilters = {
  query: "",
  status: "all",
  wordTiming: "all",
};

export function TranscriptsBrowser({ jobs, onRefresh }: TranscriptsBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<TranscriptFilters>(DEFAULT_FILTERS);

  const filteredJobs = useMemo(
    () => filterTranscriptJobs(jobs, filters),
    [jobs, filters],
  );

  const folders = useMemo(() => listTranscriptFolders(filteredJobs), [filteredJobs]);

  const folderJobs = useMemo(() => {
    if (!activeFolder) return [];
    return jobsInFolder(filteredJobs, activeFolder);
  }, [filteredJobs, activeFolder]);

  function updateFilter<K extends keyof TranscriptFilters>(key: K, value: TranscriptFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (viewMode === "grid") setActiveFolder(null);
  }

  function switchViewMode(mode: ViewMode) {
    setViewMode(mode);
    if (mode === "list") setActiveFolder(null);
  }

  return (
    <div className="space-y-4">
      <TranscriptToolbar
        filters={filters}
        viewMode={viewMode}
        onFilterChange={updateFilter}
        onViewModeChange={switchViewMode}
      />

      {viewMode === "grid" && (
        <>
          {activeFolder && (
            <Breadcrumb
              folderLabel={folderLabel(activeFolder)}
              onBack={() => setActiveFolder(null)}
            />
          )}

          {activeFolder ? (
            folderJobs.length > 0 ? (
              <JobGrid jobs={folderJobs} />
            ) : (
              <EmptyFiltered message="No transcripts in this folder match your filters." />
            )
          ) : folders.length > 0 ? (
            <FolderGrid folders={folders} onOpen={setActiveFolder} />
          ) : (
            <EmptyFiltered message="No transcripts match your filters." />
          )}
        </>
      )}

      {viewMode === "list" && (
        filteredJobs.length > 0 ? (
          <TranscriptsTable jobs={filteredJobs} onRefresh={onRefresh} />
        ) : (
          <EmptyFiltered message="No transcripts match your filters." />
        )
      )}
    </div>
  );
}

function TranscriptToolbar({
  filters,
  viewMode,
  onFilterChange,
  onViewModeChange,
}: {
  filters: TranscriptFilters;
  viewMode: ViewMode;
  onFilterChange: <K extends keyof TranscriptFilters>(key: K, value: TranscriptFilters[K]) => void;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="glass-card space-y-3 rounded-xl p-4 ring-1 ring-border/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename…"
            value={filters.query}
            onChange={(e) => onFilterChange("query", e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.status} onValueChange={(v) => onFilterChange("status", v)}>
            <SelectTrigger size="sm" className="w-[8.5rem]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="chunking">Chunking</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.wordTiming}
            onValueChange={(v) => onFilterChange("wordTiming", v)}
          >
            <SelectTrigger size="sm" className="w-[8.5rem]">
              <SelectValue placeholder="Word timing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All timing</SelectItem>
              <SelectItem value="yes">Word timing</SelectItem>
              <SelectItem value="no">No timing</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-lg border border-border/50 p-0.5">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 gap-1.5 px-2"
              onClick={() => onViewModeChange("grid")}
            >
              <IconLayoutGrid className="size-3.5" />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 gap-1.5 px-2"
              onClick={() => onViewModeChange("list")}
            >
              <IconList className="size-3.5" />
              List
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({
  folderLabel: label,
  onBack,
}: {
  folderLabel: string;
  onBack: () => void;
}) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        type="button"
        onClick={onBack}
        className="transition-colors hover:text-foreground"
      >
        Transcripts
      </button>
      <IconChevronRight className="size-3.5 shrink-0" />
      <span className="font-medium text-foreground">{label}</span>
    </nav>
  );
}

function FolderGrid({
  folders,
  onOpen,
}: {
  folders: ReturnType<typeof listTranscriptFolders>;
  onOpen: (folderId: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onOpen(folder.id)}
          className="glass-card group flex items-start gap-3 rounded-xl p-4 text-left ring-1 ring-border/50 transition-all hover:bg-primary/5 hover:ring-primary/30"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
            <IconFolder className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{folder.label}</p>
            <p className="text-xs text-muted-foreground">
              {folder.count} transcript{folder.count !== 1 ? "s" : ""}
            </p>
          </div>
          <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </button>
      ))}
    </div>
  );
}

function JobGrid({ jobs }: { jobs: TranscribeJob[] }) {
  const router = useRouter();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => {
        const progressPct =
          job.totalChunks > 0
            ? Math.round((job.completedChunks / job.totalChunks) * 100)
            : job.status === "completed"
              ? 100
              : 0;
        const canOpen = job.status === "completed";

        return (
          <button
            key={job.id}
            type="button"
            disabled={!canOpen}
            onClick={() => canOpen && router.push(`/transcribe/${job.id}`)}
            className={cn(
              "glass-card flex flex-col gap-3 rounded-xl p-4 text-left ring-1 ring-border/50 transition-all",
              canOpen
                ? "cursor-pointer hover:bg-primary/5 hover:ring-primary/30"
                : "cursor-default opacity-90",
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-medium" title={job.filename}>
                {job.filename}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={job.status} />
                {job.hasWordTimings && (
                  <Badge variant="secondary" className="text-[0.65rem] font-normal">
                    Word timing
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Progress value={progressPct} className="h-1.5" />
              <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
                <span className="font-mono">{job.model.split("/").pop()}</span>
                <span className="tabular-nums">
                  {job.totalChunks > 0
                    ? `${job.completedChunks}/${job.totalChunks}`
                    : "—"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyFiltered({ message }: { message: string }) {
  return (
    <div className="glass-card rounded-xl px-6 py-10 text-center ring-1 ring-border/50">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
