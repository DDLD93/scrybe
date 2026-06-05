"use client";

import { IconFileTypePdf } from "@tabler/icons-react";
import { FileMetadataRow } from "@/components/transcribe/file-metadata-row";
import { ProcessLimitSlider } from "@/components/transcribe/process-limit-slider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatFileSize,
  getSliderStep,
  type PdfFileMetadata,
} from "@/lib/transcribe/file-metadata";

type PdfFilePreviewProps = {
  metadata: PdfFileMetadata | null;
  loading?: boolean;
  displayFilename: string;
  extensionWarning?: boolean;
  processLimit: number;
  processLimitMax: number;
  disabled?: boolean;
  onFilenameChange: (name: string) => void;
  onProcessLimitChange: (limit: number) => void;
};

export function PdfFilePreview({
  metadata,
  loading,
  displayFilename,
  extensionWarning,
  processLimit,
  processLimitMax,
  disabled,
  onFilenameChange,
  onProcessLimitChange,
}: PdfFilePreviewProps) {
  const pageCount = metadata?.pageCount ?? null;
  const totalLabel =
    pageCount !== null ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "Unknown";

  return (
    <Card size="sm" className="ring-border/60">
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-center gap-2">
          <IconFileTypePdf className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">PDF preview</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pdf-filename" className="text-xs text-muted-foreground">
            Filename
          </Label>
          <Input
            id="pdf-filename"
            value={displayFilename}
            disabled={disabled}
            onChange={(e) => onFilenameChange(e.target.value)}
          />
          {extensionWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Original extension restored on upload
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : metadata ? (
          <div className="space-y-2">
            <FileMetadataRow label="Size" value={formatFileSize(metadata.size)} />
            <FileMetadataRow label="Pages" value={totalLabel} />
            <FileMetadataRow
              label="Format"
              value={metadata.mimeType || "application/pdf"}
            />
          </div>
        ) : null}

        {metadata && pageCount !== null && (
          <ProcessLimitSlider
            label={`Process ${processLimit} of ${pageCount} page${pageCount === 1 ? "" : "s"}`}
            value={processLimit}
            min={1}
            max={processLimitMax}
            step={getSliderStep("pdf", processLimitMax)}
            disabled={disabled || loading}
            onChange={onProcessLimitChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
