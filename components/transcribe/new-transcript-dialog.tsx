"use client";

import { useCallback, useRef, useState } from "react";
import { IconCloudUpload } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { UploadOverlay } from "@/components/transcribe/upload-overlay";
import { detectFileKind } from "@/lib/detect-file-kind";
import { uploadTranscribeFile, type UploadProgress } from "@/lib/upload-with-progress";
import { cn } from "@/lib/utils";

import type { TranscribeFolder } from "@/hooks/use-transcribe-folders";

type NewTranscriptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  folders?: TranscribeFolder[];
};

export function NewTranscriptDialog({
  open,
  onOpenChange,
  onSuccess,
  folders = [],
}: NewTranscriptDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [folderId, setFolderId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);
  const [uploadOverlay, setUploadOverlay] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: "uploading",
    percent: 0,
  });

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || submitting) return;

    setSubmitting(true);
    setUploadOverlay(true);
    setUploadProgress({ phase: "uploading", percent: 0 });

    try {
      const data = await uploadTranscribeFile(
        file,
        {
          folderId: folderId === "__none__" ? undefined : folderId,
        },
        setUploadProgress,
      );
      toast.success(`Processing started — job ${data.jobId.slice(0, 8)}…`);
      setFile(null);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
      setUploadOverlay(false);
    }
  }

  const busy = submitting || uploadOverlay;
  const isPdf = file ? detectFileKind(file) === "pdf" : false;

  return (
    <>
      <UploadOverlay
        open={uploadOverlay}
        filename={file?.name ?? ""}
        progress={uploadProgress}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>New file</DialogTitle>
            <DialogDescription>
              Upload audio or PDF. Processing uses your defaults from Settings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitUpload} className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              <IconCloudUpload className="size-8 text-muted-foreground" />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB · {isPdf ? "PDF" : "Audio"}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-foreground">Drop audio or PDF here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId} disabled={busy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (uncategorized)</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={!file || busy} className="w-full" size="lg">
              {submitting ? <Spinner className="size-4" /> : "Start processing"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
