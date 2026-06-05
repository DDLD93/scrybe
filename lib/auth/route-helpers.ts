import { getTranscribeFolder, getTranscribeJob } from "@/lib/db/queries";
import { assertFolderAccess, assertJobAccess, getFileScope } from "@/lib/auth/file-access";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import type { SessionUser } from "@/lib/auth/get-session";

export async function requireAuthedUser(req: Request): Promise<SessionUser> {
  return requireAuth(req);
}

export async function requireJobForUser(req: Request, jobId: string) {
  const user = await requireAuth(req);
  const job = await getTranscribeJob(jobId);
  if (!job) return { error: "Not found" as const, status: 404 as const };
  try {
    assertJobAccess(user, job);
  } catch (err) {
    return { error: authErrorResponse(err), status: 403 as const };
  }
  return { user, job };
}

export async function requireFolderForUser(req: Request, folderId: string) {
  const user = await requireAuth(req);
  const folder = await getTranscribeFolder(folderId);
  if (!folder) return { error: "Not found" as const, status: 404 as const };
  try {
    assertFolderAccess(user, folder);
  } catch (err) {
    return { error: authErrorResponse(err), status: 403 as const };
  }
  return { user, folder };
}

export { getFileScope, authErrorResponse };
