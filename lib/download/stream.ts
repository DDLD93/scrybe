import { spawn } from "child_process";
import { Readable } from "stream";
import { buildYtdlpArgv, type DownloadJobOptions } from "@/lib/download/argv-builder";
import {
  guessContentType,
  presetExtension,
  sanitizeFilename,
} from "@/lib/download/content-type";
import { runYtdlpOrThrow } from "@/lib/download/executor";

export function contentDispositionAttachment(filename: string): string {
  const safe = sanitizeFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || "download";
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function resolveStreamFilename(
  url: string,
  preset: string | null | undefined,
  options: DownloadJobOptions,
): Promise<string> {
  try {
    const argv = buildYtdlpArgv(url, {
      preset,
      options,
      printFilename: true,
    });
    const result = await runYtdlpOrThrow(argv, { timeoutSec: 60 });
    const name = result.stdout.trim().split("\n").filter(Boolean)[0];
    if (name) return sanitizeFilename(name);
  } catch {
    /* use fallback */
  }
  return `download.${presetExtension(preset)}`;
}

export async function createYtdlpDownloadStream(params: {
  url: string;
  preset?: string | null;
  options?: DownloadJobOptions;
  signal?: AbortSignal;
}): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  filename: string;
}> {
  const options = params.options ?? {};
  const filename = await resolveStreamFilename(params.url, params.preset, options);
  const ext = filename.includes(".") ? filename.split(".").pop()! : presetExtension(params.preset);
  const contentType = guessContentType(ext);

  const argv = buildYtdlpArgv(params.url, {
    preset: params.preset,
    options,
    streamToStdout: true,
  });
  const bin = argv[0];
  const args = argv.slice(1);

  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const nodeStream = child.stdout;
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  const onAbort = () => {
    child.kill("SIGTERM");
  };
  params.signal?.addEventListener("abort", onAbort);

  child.on("close", (code) => {
    params.signal?.removeEventListener("abort", onAbort);
    if (code !== 0 && !params.signal?.aborted) {
      const msg = stderr.trim().split("\n").slice(-3).join(" ") || "yt-dlp failed";
      nodeStream.destroy(new Error(msg));
    }
  });

  child.on("error", (err) => {
    params.signal?.removeEventListener("abort", onAbort);
    nodeStream.destroy(err);
  });

  return { body: webStream, contentType, filename };
}
