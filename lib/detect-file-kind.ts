export type FileKind = "audio" | "pdf";

export function detectFileKind(file: File): FileKind {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  return "audio";
}

export const TRANSCRIBE_JOB_PATH =
  /^\/transcribe\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
