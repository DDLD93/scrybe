import { getTranscribeJob } from "@/lib/db/queries";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { assertJobAccess } from "@/lib/auth/file-access";
import { error } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/get-session";
import type { transcribeJobs } from "@/lib/db/schema";

type JobRow = typeof transcribeJobs.$inferSelect;

type JobAccessResult =
  | { ok: true; user: SessionUser; job: JobRow }
  | { ok: false; response: Response };

export async function loadJobForUser(req: Request, jobId: string): Promise<JobAccessResult> {
  try {
    const user = await requireAuth(req);
    const job = await getTranscribeJob(jobId);
    if (!job) return { ok: false, response: error("Not found", 404) };
    assertJobAccess(user, job);
    return { ok: true, user, job };
  } catch (err) {
    return { ok: false, response: authErrorResponse(err) };
  }
}
