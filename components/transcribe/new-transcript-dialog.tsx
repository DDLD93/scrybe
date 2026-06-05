"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AudioFilePreview } from "@/components/transcribe/audio-file-preview";
import { FileKindTabs } from "@/components/transcribe/file-kind-tabs";
import { PdfFilePreview } from "@/components/transcribe/pdf-file-preview";
import { TranscribeFileDropZone } from "@/components/transcribe/transcribe-file-drop-zone";
import { UploadOverlay } from "@/components/transcribe/upload-overlay";
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
import { useTranscribeFile } from "@/hooks/use-transcribe-file";
import { uploadTranscribeFile, type UploadProgress } from "@/lib/upload-with-progress";

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
  const {
    selectedKind,
    setKind,
    file,
    setFile,
    metadata,
    status,
    displayFilename,
    setDisplayFilename,
    extensionWarning,
    processLimit,
    setProcessLimit,
    processLimitMax,
    blockers,
    canSubmit,
    uploadParams,
    reset,
  } = useTranscribeFile();

  const [folderId, setFolderId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);
  const [uploadOverlay, setUploadOverlay] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: "uploading",
    percent: 0,
  });

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !uploadParams || !canSubmit || submitting) return;

    setSubmitting(true);
    setUploadOverlay(true);
    setUploadProgress({ phase: "uploading", percent: 0 });

    try {
      const data = await uploadTranscribeFile(
        file,
        {
          ...uploadParams,
          folderId: folderId === "__none__" ? undefined : folderId,
        },
        setUploadProgress,
      );
      toast.success(`Processing started — job ${data.jobId.slice(0, 8)}…`);
      reset();
      setFolderId("__none__");
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
  const loading = status === "loading";

  return (
    <>
      <UploadOverlay
        open={uploadOverlay}
        filename={uploadParams?.filename ?? file?.name ?? ""}
        progress={uploadProgress}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          if (!next) reset();
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>New file</DialogTitle>
            <DialogDescription>
              Choose audio or PDF, review metadata, then start processing with your Settings defaults.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitUpload} className="space-y-4">
            <FileKindTabs
              value={selectedKind}
              onChange={setKind}
              disabled={busy}
            />

            <TranscribeFileDropZone
              kind={selectedKind}
              file={file}
              disabled={busy}
              onFile={setFile}
            />

            {file && selectedKind === "audio" && (
              <AudioFilePreview
                metadata={metadata?.kind === "audio" ? metadata : null}
                loading={loading}
                displayFilename={displayFilename}
                extensionWarning={extensionWarning}
                processLimit={processLimit}
                processLimitMax={processLimitMax}
                disabled={busy}
                onFilenameChange={setDisplayFilename}
                onProcessLimitChange={setProcessLimit}
              />
            )}

            {file && selectedKind === "pdf" && (
              <PdfFilePreview
                metadata={metadata?.kind === "pdf" ? metadata : null}
                loading={loading}
                displayFilename={displayFilename}
                extensionWarning={extensionWarning}
                processLimit={processLimit}
                processLimitMax={processLimitMax}
                disabled={busy}
                onFilenameChange={setDisplayFilename}
                onProcessLimitChange={setProcessLimit}
              />
            )}

            {blockers.length > 0 && (
              <ul className="space-y-1 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {blockers.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            )}

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

            <Button type="submit" disabled={!canSubmit || busy} className="w-full" size="lg">
              {submitting ? <Spinner className="size-4" /> : "Start processing"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
