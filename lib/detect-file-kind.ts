export type FileKind = "audio" | "pdf";

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function detectFileKind(file: File): FileKind {
  return isPdfFile(file) ? "pdf" : "audio";
}

export const TRANSCRIBE_JOB_PATH =
  /^\/transcribe\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
