import { getStream } from "@/lib/storage/s3";
import { error, handleRoute } from "@/lib/api";
import { authErrorResponse } from "@/lib/auth/require-auth";
import { loadJobForUser } from "@/lib/auth/job-guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const { id } = await params;
      const access = await loadJobForUser(req, id);
      if (!access.ok) return access.response;
      const { job } = access;
      if (!job.resultKey) {
        return error("Result not ready", 404);
      }
      const stream = await getStream(job.resultKey);
      const base = job.filename.replace(/\.[^.]+$/, "");
      return new Response(stream as unknown as BodyInit, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${base}.md"`,
        },
      });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
