"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IconChevronRight,
  IconDotsVertical,
  IconFolder,
  IconFolderPlus,
  IconLayoutGrid,
  IconList,
  IconPencil,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DeleteFolderDialog } from "@/components/transcribe/delete-folder-dialog";
import { EditTranscriptDialog } from "@/components/transcribe/edit-transcript-dialog";
import { FolderFormDialog } from "@/components/transcribe/folder-form-dialog";
import { TranscriptsTable } from "@/components/transcribe/transcripts-table";
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
import type { TranscribeFolder } from "@/hooks/use-transcribe-folders";
import {
  filterTranscriptJobs,
  folderLabel,
  jobsForFolder,
  toFolderCards,
  UNCATEGORIZED_FOLDER,
  type TranscriptFilters,
} from "@/lib/transcribe/folders";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

type TranscriptsBrowserProps = {
  jobs: TranscribeJob[];
  folders: TranscribeFolder[];
  onRefresh: () => void;
  onRefreshFolders: () => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
};

const DEFAULT_FILTERS: TranscriptFilters = {
  query: "",
  status: "all",
  wordTiming: "all",
  folder: "all",
};

export function TranscriptsBrowser({
  jobs,
  folders,
  onRefresh,
  onRefreshFolders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: TranscriptsBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [viewModeLoaded, setViewModeLoaded] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<TranscriptFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    let cancelled = false;
    async function loadDefaultView() {
      try {
        const res = await fetch("/api/transcribe/settings");
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const view = data.settings?.defaultView;
        if (view === "grid" || view === "list") setViewMode(view);
      } finally {
        if (!cancelled) setViewModeLoaded(true);
      }
    }
    void loadDefaultView();
    return () => {
      cancelled = true;
    };
  }, []);

  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderFormMode, setFolderFormMode] = useState<"create" | "rename">("create");
  const [folderToEdit, setFolderToEdit] = useState<TranscribeFolder | null>(null);
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TranscribeFolder | null>(null);
  const [folderDeleting, setFolderDeleting] = useState(false);

  const [jobToEdit, setJobToEdit] = useState<TranscribeJob | null>(null);
  const [jobSaving, setJobSaving] = useState(false);

  const filteredJobs = useMemo(
    () => filterTranscriptJobs(jobs, filters),
    [jobs, filters],
  );

  const folderCards = useMemo(() => toFolderCards(folders, jobs), [folders, jobs]);

  const gridFolderJobs = useMemo(() => {
    if (!activeFolder) return [];
    if (activeFolder === UNCATEGORIZED_FOLDER) {
      return filterTranscriptJobs(jobsForFolder(jobs, null), filters);
    }
    return filterTranscriptJobs(jobsForFolder(jobs, activeFolder), filters);
  }, [jobs, activeFolder, filters]);

  function updateFilter<K extends keyof TranscriptFilters>(key: K, value: TranscriptFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function switchViewMode(mode: ViewMode) {
    setViewMode(mode);
    if (mode === "list") setActiveFolder(null);
    if (viewModeLoaded) {
      void fetch("/api/transcribe/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultView: mode }),
      });
    }
  }

  function openCreateFolder() {
    setFolderFormMode("create");
    setFolderToEdit(null);
    setFolderFormOpen(true);
  }

  function openRenameFolder(folder: TranscribeFolder) {
    setFolderFormMode("rename");
    setFolderToEdit(folder);
    setFolderFormOpen(true);
  }

  async function handleFolderSubmit(name: string) {
    setFolderSaving(true);
    try {
      if (folderFormMode === "create") {
        await onCreateFolder(name);
        toast.success("Folder created");
      } else if (folderToEdit) {
        await onRenameFolder(folderToEdit.id, name);
        toast.success("Folder renamed");
      }
      setFolderFormOpen(false);
      onRefreshFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setFolderSaving(false);
    }
  }

  async function confirmDeleteFolder() {
    if (!folderToDelete) return;
    setFolderDeleting(true);
    try {
      await onDeleteFolder(folderToDelete.id);
      toast.success("Folder deleted");
      if (activeFolder === folderToDelete.id) setActiveFolder(null);
      setFolderToDelete(null);
      onRefreshFolders();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder");
    } finally {
      setFolderDeleting(false);
    }
  }

  async function handleEditJob(data: { filename: string; folderId: string | null }) {
    if (!jobToEdit) return;
    setJobSaving(true);
    try {
      const res = await fetch(`/api/transcribe/jobs/${jobToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update file");
      toast.success("File updated");
      setJobToEdit(null);
      onRefresh();
      onRefreshFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update file");
    } finally {
      setJobSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <FolderFormDialog
        mode={folderFormMode}
        folder={folderToEdit}
        open={folderFormOpen}
        saving={folderSaving}
        onOpenChange={setFolderFormOpen}
        onSubmit={handleFolderSubmit}
      />

      <DeleteFolderDialog
        folder={folderToDelete}
        deleting={folderDeleting}
        onOpenChange={(open) => {
          if (!open && !folderDeleting) setFolderToDelete(null);
        }}
        onConfirm={confirmDeleteFolder}
      />

      <EditTranscriptDialog
        job={jobToEdit}
        folders={folders}
        saving={jobSaving}
        onOpenChange={(open) => {
          if (!open && !jobSaving) setJobToEdit(null);
        }}
        onSubmit={handleEditJob}
      />

      <TranscriptToolbar
        filters={filters}
        viewMode={viewMode}
        folders={folders}
        onFilterChange={updateFilter}
        onViewModeChange={switchViewMode}
        onCreateFolder={openCreateFolder}
      />

      {viewMode === "grid" && (
        <>
          {activeFolder && (
            <Breadcrumb
              folderLabel={folderLabel(activeFolder, folders)}
              onBack={() => setActiveFolder(null)}
            />
          )}

          {activeFolder ? (
            gridFolderJobs.length > 0 ? (
              <JobGrid jobs={gridFolderJobs} />
            ) : (
              <EmptyFiltered message="No files in this folder match your filters." />
            )
          ) : (
            <FolderGrid
              folders={folderCards}
              allFolders={folders}
              onOpen={setActiveFolder}
              onRename={(id) => {
                const folder = folders.find((f) => f.id === id);
                if (folder) openRenameFolder(folder);
              }}
              onDelete={(id) => {
                const folder = folders.find((f) => f.id === id);
                if (folder) setFolderToDelete(folder);
              }}
            />
          )}
        </>
      )}

      {viewMode === "list" && (
        filteredJobs.length > 0 ? (
          <TranscriptsTable
            jobs={filteredJobs}
            onRefresh={onRefresh}
            onEditJob={setJobToEdit}
          />
        ) : (
          <EmptyFiltered
            message={
              jobs.length === 0
                ? "No files yet."
                : "No files match your filters."
            }
          />
        )
      )}
    </div>
  );
}

function TranscriptToolbar({
  filters,
  viewMode,
  folders,
  onFilterChange,
  onViewModeChange,
  onCreateFolder,
}: {
  filters: TranscriptFilters;
  viewMode: ViewMode;
  folders: TranscribeFolder[];
  onFilterChange: <K extends keyof TranscriptFilters>(key: K, value: TranscriptFilters[K]) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateFolder: () => void;
}) {
  return (
    <div className="glass-card space-y-3 rounded-xl p-4 ring-1 ring-border/50">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          <Select value={filters.folder} onValueChange={(v) => onFilterChange("folder", v)}>
            <SelectTrigger size="sm" className="w-[9rem]">
              <SelectValue placeholder="Folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              <SelectItem value={UNCATEGORIZED_FOLDER}>Uncategorized</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={onCreateFolder}>
            <IconFolderPlus className="size-3.5" />
            New folder
          </Button>

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
        Library
      </button>
      <IconChevronRight className="size-3.5 shrink-0" />
      <span className="font-medium text-foreground">{label}</span>
    </nav>
  );
}

function FolderGrid({
  folders,
  allFolders,
  onOpen,
  onRename,
  onDelete,
}: {
  folders: ReturnType<typeof toFolderCards>;
  allFolders: TranscribeFolder[];
  onOpen: (folderId: string) => void;
  onRename: (folderId: string) => void;
  onDelete: (folderId: string) => void;
}) {
  if (folders.length === 0 && allFolders.length === 0) {
    return (
      <EmptyFiltered message="No folders yet. Create one to organize your files." />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {allFolders.map((folder) => (
        <FolderCard
          key={folder.id}
          label={folder.name}
          count={folder.jobCount}
          canManage
          onOpen={() => onOpen(folder.id)}
          onRename={() => onRename(folder.id)}
          onDelete={() => onDelete(folder.id)}
          deleteDisabled={folder.jobCount > 0}
        />
      ))}

      {folders
        .filter((f) => f.id === UNCATEGORIZED_FOLDER)
        .map((folder) => (
          <FolderCard
            key={folder.id}
            label={folder.label}
            count={folder.count}
            onOpen={() => onOpen(folder.id)}
          />
        ))}
    </div>
  );
}

function FolderCard({
  label,
  count,
  canManage,
  deleteDisabled,
  onOpen,
  onRename,
  onDelete,
}: {
  label: string;
  count: number;
  canManage?: boolean;
  deleteDisabled?: boolean;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="glass-card group flex items-start gap-3 rounded-xl p-4 ring-1 ring-border/50 transition-all hover:bg-primary/5 hover:ring-primary/30">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <IconFolder className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {count} file{count !== 1 ? "s" : ""}
          </p>
        </div>
        <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="shrink-0">
              <IconDotsVertical className="size-4" />
              <span className="sr-only">Folder actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>
              <IconPencil className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={deleteDisabled}
              onClick={onDelete}
            >
              <IconTrash className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
