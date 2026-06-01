import {
  deleteDownloadJob,
  getDownloadArtifacts,
  getDownloadJob,
  updateDownloadJob,
} from "@/lib/db/queries";
import { requestDownloadStop } from "@/lib/download/processor";
import { deleteObject } from "@/lib/storage/s3";
import { requestStop } from "@/lib/worker/queue";

export async function deleteDownloadJobCompletely(jobId: string): Promise<boolean> {
  const job = await getDownloadJob(jobId);
  if (!job) return false;

  if (["pending", "processing"].includes(job.status)) {
    await updateDownloadJob(jobId, { status: "stopped" });
    requestDownloadStop(jobId);
    requestStop({ type: "download", jobId });
  }

  const artifacts = await getDownloadArtifacts(jobId);
  await Promise.all(artifacts.map((a) => deleteObject(a.objectKey).catch(() => {})));

  return deleteDownloadJob(jobId);
}
