"use client";

import { useState } from "react";
import { IconPencil } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { TranscribeJob } from "@/hooks/use-transcribe-jobs";
import type { TranscribeFolder } from "@/hooks/use-transcribe-folders";

type EditTranscriptDialogProps = {
  job: TranscribeJob | null;
  folders: TranscribeFolder[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { filename: string; folderId: string | null }) => void;
};

function EditTranscriptDialogContent({
  job,
  folders,
  saving,
  onOpenChange,
  onSubmit,
}: {
  job: TranscribeJob;
  folders: TranscribeFolder[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { filename: string; folderId: string | null }) => void;
}) {
  const [filename, setFilename] = useState(job.filename);
  const [folderId, setFolderId] = useState<string>(job.folderId ?? "__none__");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = filename.trim();
    if (!trimmed) return;
    onSubmit({
      filename: trimmed,
      folderId: folderId === "__none__" ? null : folderId,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <IconPencil className="size-4" />
          Edit transcript
        </DialogTitle>
        <DialogDescription>
          Rename the file or move it to another folder.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="transcript-filename">Filename</Label>
          <Input
            id="transcript-filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={saving}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Folder</Label>
          <Select value={folderId} onValueChange={setFolderId} disabled={saving}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Uncategorized</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !filename.trim()}>
          {saving ? (
            <>
              <Spinner className="size-3.5" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditTranscriptDialog({
  job,
  folders,
  saving,
  onOpenChange,
  onSubmit,
}: EditTranscriptDialogProps) {
  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        {job ? (
          <EditTranscriptDialogContent
            key={job.id}
            job={job}
            folders={folders}
            saving={saving}
            onOpenChange={onOpenChange}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
