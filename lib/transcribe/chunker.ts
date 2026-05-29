import { spawn } from "child_process";
import { readdir } from "fs/promises";
import { join } from "path";
import { config } from "@/lib/config";

export type ProbeResult = {
  duration: number;
  size: number;
};

export type SegmentDescriptor = {
  path: string;
  idx: number;
  startSec: number;
  durSec: number;
};

function runCmd(bin: string, args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `${bin} failed`));
      else resolve({ stdout, code: code ?? 0 });
    });
  });
}

export async function probe(input: string): Promise<ProbeResult> {
  const { stdout } = await runCmd(config.ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration,size",
    "-print_format", "json",
    input,
  ]);
  const json = JSON.parse(stdout);
  const format = json.format ?? {};
  return {
    duration: parseFloat(format.duration ?? "0") || 0,
    size: parseInt(format.size ?? "0", 10) || 0,
  };
}

export async function split(
  input: string,
  outDir: string,
  unit: string,
  size: number,
  ext: string,
): Promise<SegmentDescriptor[]> {
  const { duration, size: byteSize } = await probe(input);
  let secondsPerSegment: number;

  if (unit === "mb") {
    const bytesPerSec = duration > 0 ? byteSize / duration : 0;
    const targetBytes = size * 1024 * 1024;
    secondsPerSegment = bytesPerSec > 0
      ? Math.max(5, Math.floor(targetBytes / bytesPerSec))
      : 60;
  } else {
    secondsPerSegment = Math.max(1, Math.floor(size));
  }

  const pattern = join(outDir, `%03d.${ext}`);
  const baseArgs = [
    "-i", input,
    "-f", "segment",
    "-segment_time", String(secondsPerSegment),
    "-reset_timestamps", "1",
    "-y",
    pattern,
  ];

  try {
    await runCmd(config.ffmpegPath, [...baseArgs.slice(0, -1), "-c", "copy", pattern]);
  } catch {
    await runCmd(config.ffmpegPath, baseArgs);
  }

  const files = (await readdir(outDir))
    .filter((f) => f.match(/^\d{3}\./))
    .sort();

  if (files.length === 0) throw new Error("ffmpeg produced no segments");

  return files.map((f, idx) => {
    const startSec = idx * secondsPerSegment;
    const durSec = Math.min(secondsPerSegment, Math.max(0, duration - startSec));
    return { path: join(outDir, f), idx, startSec, durSec };
  });
}

export async function normalizeForPlayback(input: string, output: string): Promise<void> {
  await runCmd(config.ffmpegPath, [
    "-i", input,
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    output,
  ]);
}

export function extFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "mp3";
}

export function audioFormatFromExt(ext: string): string {
  const map: Record<string, string> = {
    mp3: "mp3", wav: "wav", m4a: "m4a", mp4: "mp4", webm: "webm", ogg: "ogg", flac: "flac",
  };
  return map[ext] ?? "mp3";
}
