import { updateTranscribeJob } from "@/lib/db/queries";
import { requestStop } from "@/lib/worker/queue";
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
      const { job } = access;
      if (["pending", "chunking", "processing"].includes(job.status)) {
        await updateTranscribeJob(id, { status: "stopped" });
        requestStop({ type: "transcribe", jobId: id });
      }
      return accepted({ jobId: id, stopped: true });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
