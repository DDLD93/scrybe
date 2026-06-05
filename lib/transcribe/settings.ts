import type { LibraryViewMode } from "@/lib/db/schema";
import type { getTranscribeSettings } from "@/lib/db/queries";

export type SystemSettings = {
  chunkUnit: string;
  chunkSize: string;
  audioModel: string;
  pdfModel: string;
  defaultView: LibraryViewMode;
  lastSystemPromptId: string | null;
  lastPdfSystemPromptId: string | null;
  customSystemPrompt: string | null;
};

const DEFAULT_AUDIO_MODEL = "openai/whisper-1";
const DEFAULT_CHUNK_UNIT = "seconds";
const DEFAULT_CHUNK_SIZE = "30";
const DEFAULT_VIEW: LibraryViewMode = "list";

export function toSystemSettings(
  row: Awaited<ReturnType<typeof getTranscribeSettings>>,
): SystemSettings {
  return {
    chunkUnit: row?.chunkUnit ?? DEFAULT_CHUNK_UNIT,
    chunkSize: row?.chunkSize != null ? String(row.chunkSize) : DEFAULT_CHUNK_SIZE,
    audioModel: row?.model ?? DEFAULT_AUDIO_MODEL,
    pdfModel: row?.pdfModel ?? "",
    defaultView: row?.defaultView === "grid" ? "grid" : DEFAULT_VIEW,
    lastSystemPromptId: row?.lastSystemPromptId ?? null,
    lastPdfSystemPromptId: row?.lastPdfSystemPromptId ?? null,
    customSystemPrompt: row?.systemPrompt ?? null,
  };
}

export function resolveModelForJob(
  settings: SystemSettings,
  jobKind: "audio" | "pdf",
  override?: string | null,
): string {
  if (override) return override;
  if (jobKind === "pdf") return settings.pdfModel || settings.audioModel;
  return settings.audioModel;
}

export function resolveChunkingForJob(
  settings: SystemSettings,
  jobKind: "audio" | "pdf",
  unitOverride?: string | null,
  sizeOverride?: string | null,
): { unit: string; size: number } {
  if (jobKind === "pdf") return { unit: "page", size: 1 };
  const unit = unitOverride === "mb" ? "mb" : settings.chunkUnit === "mb" ? "mb" : "seconds";
  const sizeRaw = sizeOverride ?? settings.chunkSize;
  const size = parseFloat(sizeRaw);
  return { unit, size: Number.isFinite(size) && size > 0 ? size : 30 };
}
