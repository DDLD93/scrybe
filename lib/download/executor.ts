import { spawn } from "child_process";
import { parseProgressLine } from "@/lib/download/progress-parser";
import type { DownloadProgress } from "@/lib/db/schema";

export type YtdlpResult = {
  stdout: string;
  stderr: string;
  code: number;
};

export async function runYtdlp(
  argv: string[],
  opts?: {
    timeoutSec?: number;
    onProgress?: (p: DownloadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<YtdlpResult> {
  const bin = argv[0];
  const args = argv.slice(1);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = opts?.timeoutSec
      ? setTimeout(() => {
          killed = true;
          child.kill("SIGTERM");
        }, opts.timeoutSec * 1000)
      : null;

    const onAbort = () => {
      killed = true;
      child.kill("SIGTERM");
    };
    opts?.signal?.addEventListener("abort", onAbort);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });

    child.stderr.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stderr += chunk;
      for (const line of chunk.split("\n")) {
        const p = parseProgressLine(line);
        if (p && opts?.onProgress) opts.onProgress(p);
      }
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      opts?.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      opts?.signal?.removeEventListener("abort", onAbort);
      if (killed && opts?.signal?.aborted) {
        reject(new Error("yt-dlp stopped"));
        return;
      }
      if (killed) {
        reject(new Error("yt-dlp timed out"));
        return;
      }
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

export async function runYtdlpOrThrow(
  argv: string[],
  opts?: Parameters<typeof runYtdlp>[1],
): Promise<YtdlpResult> {
  const result = await runYtdlp(argv, opts);
  if (result.code !== 0) {
    const msg = result.stderr.trim().split("\n").slice(-3).join(" ") || "yt-dlp failed";
    throw new Error(msg);
  }
  return result;
}
