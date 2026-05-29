import { getTranscribeJob, updateTranscribeJob } from "@/lib/db/queries";
import { enqueue, requestStop } from "@/lib/worker/queue";
import { accepted, error, handleRoute } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job) return error("Not found", 404);
    if (["pending", "chunking", "processing"].includes(job.status)) {
      await updateTranscribeJob(id, { status: "stopped" });
      requestStop({ type: "transcribe", jobId: id });
    }
    return accepted({ jobId: id, stopped: true });
  });
}
