import {
  deleteTranscribeJob,
  getTranscribeChunks,
  getTranscribeJob,
  updateTranscribeJob,
} from "@/lib/db/queries";
import { deleteObject } from "@/lib/storage/s3";
import { requestStop } from "@/lib/worker/queue";
import { requestTranscribeStop } from "@/lib/transcribe/processor";

function collectJobKeys(
  job: NonNullable<Awaited<ReturnType<typeof getTranscribeJob>>>,
  chunks: Awaited<ReturnType<typeof getTranscribeChunks>>,
): string[] {
  const keys = new Set<string>();
  for (const key of [job.sourceKey, job.resultKey, job.playbackKey, job.transcriptKey]) {
    if (key) keys.add(key);
  }
  for (const chunk of chunks) {
    if (chunk.objectKey) keys.add(chunk.objectKey);
  }
  return [...keys];
}

export async function deleteTranscribeJobCompletely(jobId: string): Promise<boolean> {
  const job = await getTranscribeJob(jobId);
  if (!job) return false;

  if (["pending", "chunking", "processing"].includes(job.status)) {
    await updateTranscribeJob(jobId, { status: "stopped" });
    requestTranscribeStop(jobId);
    requestStop({ type: "transcribe", jobId });
  }

  const chunks = await getTranscribeChunks(jobId);
  const keys = collectJobKeys(job, chunks);
  await Promise.all(keys.map((key) => deleteObject(key).catch(() => {})));

  return deleteTranscribeJob(jobId);
}
