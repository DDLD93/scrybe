import { getTranscribeJob, updateTranscribeJob } from "@/lib/db/queries";
import { clearTranscribeStop } from "@/lib/transcribe/processor";
import { enqueue } from "@/lib/worker/queue";
import { accepted, error, handleRoute } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job) return error("Not found", 404);
    clearTranscribeStop(id);
    await updateTranscribeJob(id, { status: "processing", error: null });
    enqueue({ type: "transcribe", jobId: id });
    return accepted({ jobId: id, resumed: true });
  });
}
