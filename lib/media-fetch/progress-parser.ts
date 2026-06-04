import type { FetchProgress } from "@/lib/db/schema";

export function parseProgressLine(line: string): FetchProgress | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("download:")) return null;
  const parts = trimmed.slice("download:".length).split("|");
  if (parts.length < 3) return null;

  const percentStr = parts[0].replace("%", "").trim();
  const percent = parseFloat(percentStr);
  const speed = parts[1]?.trim() || undefined;
  const etaStr = parts[2]?.trim();
  let eta: number | undefined;
  if (etaStr && etaStr !== "NA") {
    const n = parseInt(etaStr, 10);
    if (Number.isFinite(n)) eta = n;
  }

  return {
    percent: Number.isFinite(percent) ? percent : undefined,
    speed,
    eta,
  };
}
