import type { FileKind } from "@/lib/detect-file-kind";

export type { FileKind };

export const UPLOAD_MAX_BYTES = 1024 * 1024 * 1024;
export const PDF_MAX_PAGES = 500;

const AUDIO_EXTENSIONS = new Set([
  "mp3", "wav", "m4a", "mp4", "webm", "ogg", "flac", "aac", "wma", "opus",
]);

export type AudioFileMetadata = {
  kind: "audio";
  name: string;
  size: number;
  mimeType: string;
  durationSec: number | null;
};

export type PdfFileMetadata = {
  kind: "pdf";
  name: string;
  size: number;
  mimeType: string;
  pageCount: number | null;
};

export type FileMetadata = AudioFileMetadata | PdfFileMetadata;

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isAudioFile(file: File): boolean {
  if (isPdfFile(file)) return false;
  if (file.type.startsWith("audio/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

export function isValidFileForKind(file: File, kind: FileKind): boolean {
  return kind === "pdf" ? isPdfFile(file) : isAudioFile(file);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export type SanitizeFilenameResult =
  | { ok: true; filename: string; extensionWarning: boolean }
  | { ok: false; error: string };

export function sanitizeFilename(
  name: string,
  originalName?: string,
): SanitizeFilenameResult {
  const trimmed = name.trim().replace(/[\\/]+/g, "").replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Filename cannot be empty" };

  const originalExt = originalName ? getFileExtension(originalName) : "";
  const currentExt = getFileExtension(trimmed);
  const extensionWarning = Boolean(originalExt && currentExt !== originalExt);

  let filename = trimmed;
  if (originalExt && currentExt !== originalExt) {
    const base = trimmed.includes(".") ? trimmed.slice(0, trimmed.lastIndexOf(".")) : trimmed;
    filename = `${base}.${originalExt}`;
  }

  return { ok: true, filename, extensionWarning };
}

export function getUploadBlockers(
  meta: FileMetadata | null,
  kind: FileKind,
  opts?: {
    filename?: string;
    originalFilename?: string;
    processLimit?: number;
  },
): string[] {
  const blockers: string[] = [];

  if (opts?.filename !== undefined) {
    const result = sanitizeFilename(opts.filename, opts.originalFilename);
    if (!result.ok) blockers.push(result.error);
  }

  if (!meta) return blockers;

  if (meta.size > UPLOAD_MAX_BYTES) {
    blockers.push(`File exceeds ${formatFileSize(UPLOAD_MAX_BYTES)} upload limit`);
  }

  if (kind === "pdf" && meta.kind === "pdf") {
    if (meta.pageCount !== null && meta.pageCount > PDF_MAX_PAGES) {
      blockers.push(`PDF has ${meta.pageCount} pages; maximum is ${PDF_MAX_PAGES}`);
    }
  }

  const limit = opts?.processLimit;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
    blockers.push("Process limit must be at least 1");
  }

  if (kind === "pdf" && meta.kind === "pdf" && meta.pageCount === null) {
    blockers.push("Could not read page count — try another PDF");
  }

  if (kind === "audio" && meta.kind === "audio" && meta.durationSec === null) {
    blockers.push("Could not read audio duration — try another file");
  }

  return blockers;
}

export function extractAudioMetadata(file: File): Promise<AudioFileMetadata> {
  return new Promise((resolve) => {
    const base: AudioFileMetadata = {
      kind: "audio",
      name: file.name,
      size: file.size,
      mimeType: file.type || "audio/*",
      durationSec: null,
    };

    const url = URL.createObjectURL(file);
    const audio = new Audio();

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      audio.load();
    };

    const finish = (durationSec: number | null) => {
      cleanup();
      resolve({ ...base, durationSec });
    };

    audio.addEventListener("loadedmetadata", () => {
      const d = audio.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    });

    audio.addEventListener("error", () => finish(null));

    audio.preload = "metadata";
    audio.src = url;
  });
}

export async function extractPdfMetadata(file: File): Promise<PdfFileMetadata> {
  const base: PdfFileMetadata = {
    kind: "pdf",
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/pdf",
    pageCount: null,
  };

  try {
    const pdfjs = await import("pdfjs-dist");
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
    }
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
    return { ...base, pageCount: doc.numPages };
  } catch {
    return base;
  }
}

export async function extractFileMetadata(
  file: File,
  kind: FileKind,
): Promise<FileMetadata> {
  return kind === "pdf" ? extractPdfMetadata(file) : extractAudioMetadata(file);
}

export function getDefaultProcessLimit(meta: FileMetadata | null): number {
  if (!meta) return 1;
  if (meta.kind === "pdf") {
    return meta.pageCount ?? 1;
  }
  return meta.durationSec !== null ? Math.max(1, Math.ceil(meta.durationSec)) : 1;
}

export function getProcessLimitMax(meta: FileMetadata | null): number {
  return getDefaultProcessLimit(meta);
}

export function getSliderStep(kind: FileKind, max: number): number {
  if (kind === "pdf") return 1;
  return max > 1800 ? 5 : 1;
}
