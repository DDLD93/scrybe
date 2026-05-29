import { getActiveDownloadJobs, getActiveTranscribeJobs } from "@/lib/db/queries";
import { processDownloadJob, requestDownloadStop } from "@/lib/download/processor";
import {
  clearTranscribeStop,
  processTranscribeJob,
  requestTranscribeStop,
} from "@/lib/transcribe/processor";

export type WorkerJob =
  | { type: "download"; jobId: string }
  | { type: "transcribe"; jobId: string };

const queue: WorkerJob[] = [];
const queuedKeys = new Set<string>();
let pumping = false;

function jobKey(job: WorkerJob): string {
  return `${job.type}:${job.jobId}`;
}

export function enqueue(job: WorkerJob): void {
  const key = jobKey(job);
  if (queuedKeys.has(key)) return;
  queuedKeys.add(key);
  queue.push(job);
  void pump();
}

export async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      queuedKeys.delete(jobKey(job));
      try {
        if (job.type === "download") {
          await processDownloadJob(job.jobId);
        } else {
          await processTranscribeJob(job.jobId);
        }
      } catch (err) {
        console.error(`Worker job ${job.type}/${job.jobId} failed:`, err);
      }
    }
  } finally {
    pumping = false;
  }
}

export function requestStop(job: WorkerJob): void {
  const key = jobKey(job);
  const idx = queue.findIndex((j) => jobKey(j) === key);
  if (idx >= 0) {
    queue.splice(idx, 1);
    queuedKeys.delete(key);
    return;
  }
  if (job.type === "download") requestDownloadStop(job.jobId);
  else requestTranscribeStop(job.jobId);
}

export async function recover(): Promise<void> {
  try {
    const [downloads, transcribes] = await Promise.all([
      getActiveDownloadJobs(),
      getActiveTranscribeJobs(),
    ]);
    for (const { id } of downloads) enqueue({ type: "download", jobId: id });
    for (const { id } of transcribes) {
      clearTranscribeStop(id);
      enqueue({ type: "transcribe", jobId: id });
    }
  } catch (err) {
    console.error("Worker recover skipped:", err);
  }
}

export function startWorker(): void {
  void recover();
}
