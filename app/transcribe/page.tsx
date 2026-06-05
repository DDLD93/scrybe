"use client";

import { useState } from "react";
import { IconFile, IconPlus } from "@tabler/icons-react";
import { EmptyState } from "@/components/shared/empty-state";
import { NewTranscriptDialog } from "@/components/transcribe/new-transcript-dialog";
import { TranscriptsBrowser } from "@/components/transcribe/transcripts-browser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranscribeFolders } from "@/hooks/use-transcribe-folders";
import { useTranscribeJobs } from "@/hooks/use-transcribe-jobs";
import { cn } from "@/lib/utils";

export default function TranscribePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { jobs, loading, refresh, hasActiveJobs } = useTranscribeJobs(2000, dialogOpen);
  const {
    folders,
    refresh: refreshFolders,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useTranscribeFolders(2000, dialogOpen);

  function handleSuccess() {
    refresh();
    refreshFolders();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Library</h1>
          {hasActiveJobs && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn("size-2 rounded-full bg-primary live-pulse")}
                  aria-label="Jobs processing"
                />
              </TooltipTrigger>
              <TooltipContent>Processing in progress · auto-refreshes every 2s</TooltipContent>
            </Tooltip>
          )}
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {jobs.length} file{jobs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg" className="shrink-0">
          <IconPlus className="size-4" />
          New file
        </Button>
      </div>

      {loading ? (
        <div className="glass-card space-y-3 rounded-xl p-4 ring-1 ring-border/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {jobs.length === 0 && (
            <div className="glass-card rounded-xl ring-1 ring-border/50">
              <EmptyState
                icon={<IconFile className="size-6" />}
                title="No files yet"
                description="Upload audio or PDF, or paste a media URL to get started."
                actionLabel="Add your first file"
                onAction={() => setDialogOpen(true)}
              />
            </div>
          )}
          <TranscriptsBrowser
            jobs={jobs}
            folders={folders}
            onRefresh={refresh}
            onRefreshFolders={refreshFolders}
            onCreateFolder={async (name) => {
              await createFolder(name);
            }}
            onRenameFolder={async (id, name) => {
              await renameFolder(id, name);
            }}
            onDeleteFolder={async (id) => {
              await deleteFolder(id);
            }}
          />
        </>
      )}

      <NewTranscriptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        folders={folders}
      />
    </div>
  );
}
