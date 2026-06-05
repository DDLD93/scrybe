"use client";

import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { TranscribeJob } from "@/hooks/use-transcribe-jobs";

type DeleteJobDialogProps = {
  job: TranscribeJob | null;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteJobDialog({
  job,
  deleting,
  onOpenChange,
  onConfirm,
}: DeleteJobDialogProps) {
  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!deleting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconTrash className="size-4 text-destructive" />
            Delete file
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className="space-y-3">
            <p className="truncate rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 font-mono text-xs">
              {job.filename}
            </p>
            <div className="flex gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-xs/relaxed text-muted-foreground">
                Permanently removes this file, its source media, extracted text, and all
                stored chunk data from the server.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? (
              <>
                <Spinner className="size-3.5" />
                Deleting…
              </>
            ) : (
              "Delete permanently"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
