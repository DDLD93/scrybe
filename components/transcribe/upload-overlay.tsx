"use client";

import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { UploadProgress } from "@/lib/upload-with-progress";

type UploadOverlayProps = {
  open: boolean;
  filename: string;
  progress: UploadProgress;
};

export function UploadOverlay({ open, filename, progress }: UploadOverlayProps) {
  if (!open) return null;

  const isProcessing = progress.phase === "processing";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card mx-4 w-full max-w-md space-y-5 rounded-2xl p-6 shadow-2xl ring-1 ring-primary/20">
        <div className="flex items-center gap-3">
          <Spinner className="size-5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {isProcessing ? "Processing upload…" : "Uploading to storage…"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{filename}</p>
          </div>
        </div>

        {isProcessing ? (
          <div className="space-y-2">
            <div className="relative h-1.5 overflow-hidden rounded-md bg-muted">
              <div className="absolute inset-y-0 w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-md bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              Writing to bucket and starting transcription job…
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Progress value={progress.percent} className="h-1.5" />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {progress.percent}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
