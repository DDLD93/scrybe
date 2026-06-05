"use client";

import { useRef, useState } from "react";
import { IconCloudUpload } from "@tabler/icons-react";
import type { FileKind } from "@/lib/detect-file-kind";
import { cn } from "@/lib/utils";

type TranscribeFileDropZoneProps = {
  kind: FileKind;
  file: File | null;
  disabled?: boolean;
  onFile: (file: File | null) => void;
};

const ACCEPT: Record<FileKind, string> = {
  audio: "audio/*",
  pdf: "application/pdf",
};

const PLACEHOLDER: Record<FileKind, { title: string; hint: string }> = {
  audio: {
    title: "Drop audio here",
    hint: "MP3, WAV, M4A, and more",
  },
  pdf: {
    title: "Drop PDF here",
    hint: "or click to browse",
  },
};

export function TranscribeFileDropZone({
  kind,
  file,
  disabled,
  onFile,
}: TranscribeFileDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const copy = PLACEHOLDER[kind];

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && e.key === "Enter") fileInputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
        disabled && "pointer-events-none opacity-50",
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
            Click or drop to replace
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-foreground">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.hint}</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
