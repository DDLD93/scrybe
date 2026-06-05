"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FileKind } from "@/lib/detect-file-kind";
import {
  extractFileMetadata,
  getDefaultProcessLimit,
  getProcessLimitMax,
  getUploadBlockers,
  isValidFileForKind,
  sanitizeFilename,
  type FileMetadata,
} from "@/lib/transcribe/file-metadata";

export type TranscribeFileStatus = "idle" | "loading" | "ready" | "error";

export type TranscribeUploadParams = {
  filename: string;
  processPages?: number;
  processDurationSec?: number;
};

export function useTranscribeFile() {
  const [selectedKind, setSelectedKindState] = useState<FileKind>("audio");
  const [file, setFileState] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [status, setStatus] = useState<TranscribeFileStatus>("idle");
  const [kindError, setKindError] = useState<string | null>(null);
  const [displayFilename, setDisplayFilename] = useState("");
  const [processLimit, setProcessLimit] = useState(1);
  const extractGen = useRef(0);

  const reset = useCallback(() => {
    extractGen.current += 1;
    setSelectedKindState("audio");
    setFileState(null);
    setMetadata(null);
    setStatus("idle");
    setKindError(null);
    setDisplayFilename("");
    setProcessLimit(1);
  }, []);

  const setKind = useCallback((kind: FileKind) => {
    extractGen.current += 1;
    setSelectedKindState(kind);
    setFileState(null);
    setMetadata(null);
    setStatus("idle");
    setKindError(null);
    setDisplayFilename("");
    setProcessLimit(1);
  }, []);

  const setFile = useCallback(
    (next: File | null) => {
      extractGen.current += 1;
      const gen = extractGen.current;

      if (!next) {
        setFileState(null);
        setMetadata(null);
        setStatus("idle");
        setKindError(null);
        setDisplayFilename("");
        setProcessLimit(1);
        return;
      }

      if (!isValidFileForKind(next, selectedKind)) {
        setFileState(null);
        setMetadata(null);
        setStatus("error");
        setKindError(
          selectedKind === "pdf"
            ? "Select a PDF file"
            : "Select an audio file",
        );
        setDisplayFilename("");
        setProcessLimit(1);
        return;
      }

      setKindError(null);
      setFileState(next);
      setDisplayFilename(next.name);
      setStatus("loading");

      void extractFileMetadata(next, selectedKind).then((meta) => {
        if (extractGen.current !== gen) return;
        setMetadata(meta);
        const limit = getDefaultProcessLimit(meta);
        setProcessLimit(limit);
        setStatus("ready");
      });
    },
    [selectedKind],
  );

  const processLimitMax = getProcessLimitMax(metadata);
  const effectiveProcessLimit = Math.min(processLimit, processLimitMax);

  const sanitized = useMemo(
    () => sanitizeFilename(displayFilename, file?.name),
    [displayFilename, file?.name],
  );

  const extensionWarning = sanitized.ok ? sanitized.extensionWarning : false;

  const blockers = useMemo(() => {
    const list = [...(kindError ? [kindError] : [])];
    if (file && status !== "error") {
      list.push(
        ...getUploadBlockers(metadata, selectedKind, {
          filename: displayFilename,
          originalFilename: file.name,
          processLimit: effectiveProcessLimit,
        }),
      );
    }
    return list;
  }, [kindError, file, status, metadata, selectedKind, displayFilename, effectiveProcessLimit]);

  const canSubmit =
    Boolean(file) &&
    status === "ready" &&
    sanitized.ok &&
    blockers.length === 0;

  const uploadParams = useMemo((): TranscribeUploadParams | null => {
    if (!file || !sanitized.ok) return null;
    const params: TranscribeUploadParams = { filename: sanitized.filename };
    if (selectedKind === "pdf") {
      params.processPages = effectiveProcessLimit;
    } else {
      params.processDurationSec = effectiveProcessLimit;
    }
    return params;
  }, [file, sanitized, selectedKind, effectiveProcessLimit]);

  return {
    selectedKind,
    setKind,
    file,
    setFile,
    metadata,
    status,
    kindError,
    displayFilename,
    setDisplayFilename,
    extensionWarning,
    processLimit: effectiveProcessLimit,
    setProcessLimit,
    processLimitMax,
    blockers,
    canSubmit,
    uploadParams,
    reset,
  };
}
