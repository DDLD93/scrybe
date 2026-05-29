import { mkdtemp, readdir, rm } from "fs/promises";
import { join, extname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { config } from "@/lib/config";
import { buildYtdlpArgv, type DownloadJobOptions } from "@/lib/download/argv-builder";
import { runYtdlp } from "@/lib/download/executor";
import {
  getDownloadJob,
  insertDownloadArtifact,
  updateDownloadJob,
} from "@/lib/db/queries";
import { guessContentType } from "@/lib/download/content-type";
import { putFile } from "@/lib/storage/s3";

const activeControllers = new Map<string, AbortController>();

export function requestDownloadStop(jobId: string) {
  activeControllers.get(jobId)?.abort();
}

export async function processDownloadJob(jobId: string): Promise<void> {
  const job = await getDownloadJob(jobId);
  if (!job || job.status === "completed") return;

  const controller = new AbortController();
  activeControllers.set(jobId, controller);

  let workDir: string | null = null;
  try {
    await updateDownloadJob(jobId, { status: "processing", error: null, progressJson: null });
    workDir = await mkdtemp(join(tmpdir(), "scrybe-dl-"));

    const options = (job.optionsJson ?? {}) as DownloadJobOptions;
    const argv = buildYtdlpArgv(job.url, {
      preset: job.preset,
      options,
      outputDir: workDir,
    });

    const result = await runYtdlp(argv, {
      timeoutSec: config.downloadJobTimeoutSec,
      signal: controller.signal,
      onProgress: async (p) => {
        await updateDownloadJob(jobId, { progressJson: p });
      },
    });

    if (controller.signal.aborted) {
      await updateDownloadJob(jobId, { status: "stopped" });
      return;
    }

    if (result.code !== 0) {
      throw new Error(result.stderr.trim().split("\n").slice(-2).join(" ") || "Download failed");
    }

    const files = await readdir(workDir);
    const mediaFiles = files.filter(
      (f) => !f.endsWith(".json") && !f.endsWith(".jpg") && !f.endsWith(".webp") && !f.startsWith("."),
    );

    for (const name of mediaFiles) {
      const localPath = join(workDir, name);
      const ext = extname(name).slice(1).toLowerCase();
      const contentType = guessContentType(ext);
      const objectKey = `downloads/${jobId}/${name}`;
      await putFile(objectKey, localPath, contentType);
      await insertDownloadArtifact({
        id: randomUUID(),
        jobId,
        name,
        objectKey,
        contentType,
        role: "media",
      });
    }

    for (const name of files.filter((f) => f.endsWith(".json"))) {
      const localPath = join(workDir, name);
      const objectKey = `downloads/${jobId}/${name}`;
      await putFile(objectKey, localPath, "application/json");
      await insertDownloadArtifact({
        id: randomUUID(),
        jobId,
        name,
        objectKey,
        contentType: "application/json",
        role: "metadata",
      });
    }

    for (const name of files.filter((f) => f.endsWith(".jpg") || f.endsWith(".webp"))) {
      const localPath = join(workDir, name);
      const objectKey = `downloads/${jobId}/${name}`;
      await putFile(objectKey, localPath, "image/jpeg");
      await insertDownloadArtifact({
        id: randomUUID(),
        jobId,
        name,
        objectKey,
        contentType: "image/jpeg",
        role: "thumbnail",
      });
    }

    await updateDownloadJob(jobId, { status: "completed", progressJson: { percent: 100 } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const current = await getDownloadJob(jobId);
    if (current?.status === "stopped") return;
    await updateDownloadJob(jobId, { status: "failed", error: msg });
  } finally {
    activeControllers.delete(jobId);
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

