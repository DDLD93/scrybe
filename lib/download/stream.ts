import { createReadStream } from "fs";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";
import { Readable } from "stream";
import { config } from "@/lib/config";
import { buildYtdlpArgv, type DownloadJobOptions } from "@/lib/download/argv-builder";
import {
  guessContentType,
  sanitizeFilename,
} from "@/lib/download/content-type";
import { runYtdlp } from "@/lib/download/executor";
import {
  completeStreamProgress,
  failStreamProgress,
  initStreamProgress,
  setStreamProgress,
} from "@/lib/download/stream-progress";

export function contentDispositionAttachment(filename: string): string {
  const safe = sanitizeFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || "download";
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function isMediaArtifact(name: string): boolean {
  return (
    !name.endsWith(".json") &&
    !name.endsWith(".jpg") &&
    !name.endsWith(".webp") &&
    !name.startsWith(".")
  );
}

async function pickPrimaryMediaFile(workDir: string): Promise<string | null> {
  const files = await readdir(workDir);
  const mediaFiles = files.filter(isMediaArtifact);
  if (mediaFiles.length === 0) return null;

  let best = mediaFiles[0];
  let bestSize = 0;
  for (const name of mediaFiles) {
    const size = (await stat(join(workDir, name))).size;
    if (size > bestSize) {
      bestSize = size;
      best = name;
    }
  }
  return bestSize > 0 ? best : null;
}

export async function createYtdlpDownloadStream(params: {
  url: string;
  preset?: string | null;
  options?: DownloadJobOptions;
  signal?: AbortSignal;
  sessionId?: string;
}): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  filename: string;
}> {
  const options = params.options ?? {};
  const workDir = await mkdtemp(join(tmpdir(), "scrybe-stream-"));

  const cleanup = async () => {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  };

  if (params.sessionId) {
    initStreamProgress(params.sessionId);
  }

  try {
    const argv = buildYtdlpArgv(params.url, {
      preset: params.preset,
      options,
      outputDir: workDir,
    });

    const result = await runYtdlp(argv, {
      timeoutSec: config.downloadJobTimeoutSec,
      signal: params.signal,
      onProgress: (p) => {
        if (params.sessionId) setStreamProgress(params.sessionId, p);
      },
    });

    if (params.signal?.aborted) {
      await cleanup();
      throw new Error("Download aborted");
    }

    if (result.code !== 0) {
      const msg = result.stderr.trim().split("\n").slice(-3).join(" ") || "yt-dlp failed";
      if (params.sessionId) failStreamProgress(params.sessionId, msg);
      await cleanup();
      throw new Error(msg);
    }

    const mediaName = await pickPrimaryMediaFile(workDir);
    if (!mediaName) {
      const msg = "No media file produced";
      if (params.sessionId) failStreamProgress(params.sessionId, msg);
      await cleanup();
      throw new Error(msg);
    }

    const localPath = join(workDir, mediaName);
    const filename = sanitizeFilename(mediaName);
    const ext = extname(mediaName).slice(1).toLowerCase();
    const contentType = guessContentType(ext);

    if (params.sessionId) {
      completeStreamProgress(params.sessionId);
    }

    const nodeStream = createReadStream(localPath);
    nodeStream.on("close", () => {
      void cleanup();
    });
    nodeStream.on("error", () => {
      void cleanup();
    });

    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return { body: webStream, contentType, filename };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
