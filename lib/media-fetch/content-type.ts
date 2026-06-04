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
