"use client";

import { useState } from "react";
import { IconMicrophone, IconPlus } from "@tabler/icons-react";
import { EmptyState } from "@/components/shared/empty-state";
import { NewTranscriptDialog } from "@/components/transcribe/new-transcript-dialog";
import { TranscriptsBrowser } from "@/components/transcribe/transcripts-browser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Transcripts
            </h1>
            {hasActiveJobs && (
              <span
                className={cn("size-2 rounded-full bg-primary live-pulse")}
                title="Jobs processing"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} · auto-refreshes every 2s
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg" className="shrink-0">
          <IconPlus className="size-4" />
          New Transcript
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
                icon={<IconMicrophone className="size-6" />}
                title="No transcripts yet"
                description="Upload audio or paste a media URL to create your first transcription."
                actionLabel="Create your first transcript"
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
