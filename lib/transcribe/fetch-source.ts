import { mkdtemp, readdir, rm, stat } from "fs/promises";
import { join, extname } from "path";
import { tmpdir } from "os";
import { config } from "@/lib/config";
import { buildFetchArgv } from "@/lib/media-fetch/argv";
import { guessContentType } from "@/lib/media-fetch/content-type";
import { runYtdlp } from "@/lib/media-fetch/executor";
import { getTranscribeJob, updateTranscribeJob } from "@/lib/db/queries";
import { putFile } from "@/lib/storage/s3";

const activeControllers = new Map<string, AbortController>();

export function requestFetchStop(jobId: string) {
  activeControllers.get(jobId)?.abort();
}

export async function fetchSourceForJob(
  jobId: string,
  sourceUrl: string,
  fetchPreset: string | null | undefined,
): Promise<void> {
  const job = await getTranscribeJob(jobId);
  if (!job) return;

  const controller = new AbortController();
  activeControllers.set(jobId, controller);

  let workDir: string | null = null;
  try {
    await updateTranscribeJob(jobId, {
      status: "fetching",
      error: null,
      fetchProgressJson: null,
    });
    workDir = await mkdtemp(join(tmpdir(), "scrybe-fetch-"));

    const argv = buildFetchArgv(sourceUrl, {
      preset: fetchPreset,
      outputDir: workDir,
    });

    const result = await runYtdlp(argv, {
      timeoutSec: config.transcribeFetchTimeoutSec,
      signal: controller.signal,
      onProgress: async (p) => {
        await updateTranscribeJob(jobId, { fetchProgressJson: p });
      },
    });

    if (controller.signal.aborted) {
      await updateTranscribeJob(jobId, { status: "stopped" });
      return;
    }

    if (result.code !== 0) {
      throw new Error(result.stderr.trim().split("\n").slice(-2).join(" ") || "Fetch failed");
    }

    const files = await readdir(workDir);
    const mediaFiles = files.filter(
      (f) => !f.endsWith(".json") && !f.endsWith(".jpg") && !f.endsWith(".webp") && !f.startsWith("."),
    );

    if (mediaFiles.length === 0) {
      throw new Error("No media file produced");
    }

    const name = mediaFiles[0];
    const localPath = join(workDir, name);
    const ext = extname(name).slice(1).toLowerCase();
    const contentType = guessContentType(ext);
    const objectKey = `jobs/${jobId}/source/${name}`;
    const fileStat = await stat(localPath);

    await putFile(objectKey, localPath, contentType);
    await updateTranscribeJob(jobId, {
      sourceKey: objectKey,
      filename: name,
      contentType,
      fileSize: fileStat.size,
      fetchProgressJson: { percent: 100 },
      status: "pending",
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const current = await getTranscribeJob(jobId);
    if (current?.status === "stopped") return;
    await updateTranscribeJob(jobId, { status: "failed", error: msg });
    throw err;
  } finally {
    activeControllers.delete(jobId);
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
