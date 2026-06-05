"use client";

import { IconMusic } from "@tabler/icons-react";
import { FileMetadataRow } from "@/components/transcribe/file-metadata-row";
import { ProcessLimitSlider } from "@/components/transcribe/process-limit-slider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDuration,
  formatFileSize,
  getSliderStep,
  type AudioFileMetadata,
} from "@/lib/transcribe/file-metadata";

type AudioFilePreviewProps = {
  metadata: AudioFileMetadata | null;
  loading?: boolean;
  displayFilename: string;
  extensionWarning?: boolean;
  processLimit: number;
  processLimitMax: number;
  disabled?: boolean;
  onFilenameChange: (name: string) => void;
  onProcessLimitChange: (limit: number) => void;
};

export function AudioFilePreview({
  metadata,
  loading,
  displayFilename,
  extensionWarning,
  processLimit,
  processLimitMax,
  disabled,
  onFilenameChange,
  onProcessLimitChange,
}: AudioFilePreviewProps) {
  const durationSec = metadata?.durationSec ?? null;
  const fullLabel =
    durationSec !== null ? formatDuration(durationSec) : "Unknown";
  const limitLabel = formatDuration(processLimit);

  return (
    <Card size="sm" className="ring-border/60">
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-center gap-2">
          <IconMusic className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Audio preview</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audio-filename" className="text-xs text-muted-foreground">
            Filename
          </Label>
          <Input
            id="audio-filename"
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
            <FileMetadataRow label="Duration" value={fullLabel} />
            <FileMetadataRow
              label="Format"
              value={metadata.mimeType || "audio/*"}
            />
          </div>
        ) : null}

        {metadata && durationSec !== null && (
          <ProcessLimitSlider
            label={`Process first ${limitLabel} of ${fullLabel}`}
            value={processLimit}
            min={1}
            max={processLimitMax}
            step={getSliderStep("audio", processLimitMax)}
            disabled={disabled || loading}
            onChange={onProcessLimitChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
