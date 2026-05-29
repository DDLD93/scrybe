export function guessContentType(ext: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    webm: "video/webm",
    aac: "audio/aac",
    opus: "audio/opus",
    wav: "audio/wav",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

export function presetExtension(preset: string | null | undefined): string {
  const map: Record<string, string> = {
    mp3: "mp3",
    aac: "aac",
    mp4: "mp4",
    mkv: "mkv",
    best: "mp4",
    audio: "mp3",
  };
  return map[preset ?? ""] ?? "bin";
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return base || "download";
}
