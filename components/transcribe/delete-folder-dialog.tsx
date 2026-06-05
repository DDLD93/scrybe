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
import type { TranscribeFolder } from "@/hooks/use-transcribe-folders";

type DeleteFolderDialogProps = {
  folder: TranscribeFolder | null;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteFolderDialog({
  folder,
  deleting,
  onOpenChange,
  onConfirm,
}: DeleteFolderDialogProps) {
  const notEmpty = (folder?.jobCount ?? 0) > 0;

  return (
    <Dialog open={folder !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!deleting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconTrash className="size-4 text-destructive" />
            Delete folder
          </DialogTitle>
          <DialogDescription>
            {notEmpty
              ? "Only empty folders can be deleted."
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {folder && (
          <div className="space-y-3">
            <p className="truncate rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 text-sm font-medium">
              {folder.name}
            </p>
            {notEmpty ? (
              <div className="flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <p className="text-xs/relaxed text-muted-foreground">
                  This folder contains {folder.jobCount} file
                  {folder.jobCount !== 1 ? "s" : ""}. Move or delete them first.
                </p>
              </div>
            ) : null}
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
            disabled={deleting || notEmpty}
            onClick={onConfirm}
          >
            {deleting ? (
              <>
                <Spinner className="size-3.5" />
                Deleting…
              </>
            ) : (
              "Delete folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
