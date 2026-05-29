import { config } from "@/lib/config";
import { getDownloadArtifacts, getExpiredDownloadJobs, updateDownloadJob } from "@/lib/db/queries";
import { deleteObject } from "@/lib/storage/s3";

export function startRetentionSweeper(): void {
  const intervalMs = 60 * 60 * 1000;
  setInterval(() => {
    void sweep();
  }, intervalMs);
}

async function sweep(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - config.downloadRetentionHours * 60 * 60 * 1000);
    const jobs = await getExpiredDownloadJobs(cutoff);
    for (const job of jobs) {
      const artifacts = await getDownloadArtifacts(job.id);
      for (const a of artifacts) {
        await deleteObject(a.objectKey).catch(() => {});
      }
      await updateDownloadJob(job.id, { status: "expired" });
    }
  } catch (err) {
    console.error("Retention sweep failed:", err);
  }
}
