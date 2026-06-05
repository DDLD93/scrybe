import { updateTranscribeJob } from "@/lib/db/queries";
import { clearTranscribeStop } from "@/lib/transcribe/processor";
import { enqueue } from "@/lib/worker/queue";
import { accepted, handleRoute } from "@/lib/api";
import { authErrorResponse } from "@/lib/auth/require-auth";
import { loadJobForUser } from "@/lib/auth/job-guard";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const { id } = await params;
      const access = await loadJobForUser(req, id);
      if (!access.ok) return access.response;
      clearTranscribeStop(id);
      await updateTranscribeJob(id, { status: "processing", error: null });
      enqueue({ type: "transcribe", jobId: id });
      return accepted({ jobId: id, resumed: true });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
