import { eq } from "drizzle-orm";
import { AuthError } from "@/lib/auth/require-auth";
import { canSeeAllFiles } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/get-session";
import { transcribeFolders, transcribeJobs } from "@/lib/db/schema";

export type FileScope = {
  userId: string;
  seeAll: boolean;
};

export function getFileScope(user: SessionUser): FileScope {
  return {
    userId: user.id,
    seeAll: canSeeAllFiles(user.permissions),
  };
}

export function jobOwnerCondition(scope: FileScope) {
  if (scope.seeAll) return undefined;
  return eq(transcribeJobs.createdByUserId, scope.userId);
}

export function folderOwnerCondition(scope: FileScope) {
  if (scope.seeAll) return undefined;
  return eq(transcribeFolders.createdByUserId, scope.userId);
}

export function assertJobAccess(
  user: SessionUser,
  job: { createdByUserId: string | null },
): void {
  if (canSeeAllFiles(user.permissions)) return;
  if (job.createdByUserId !== user.id) {
    throw new AuthError("Forbidden", 403);
  }
}

export function assertFolderAccess(
  user: SessionUser,
  folder: { createdByUserId: string | null },
): void {
  if (canSeeAllFiles(user.permissions)) return;
  if (folder.createdByUserId !== user.id) {
    throw new AuthError("Forbidden", 403);
  }
}
