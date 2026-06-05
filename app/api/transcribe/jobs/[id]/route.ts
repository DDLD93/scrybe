import { NextRequest } from "next/server";
import {
  getTranscribeChunks,
  getTranscribeFolder,
  getTranscribeJob,
  updateTranscribeJob,
} from "@/lib/db/queries";
import { error, handleRoute, json } from "@/lib/api";
import { deleteTranscribeJobCompletely } from "@/lib/transcribe/cleanup";
import { normalizeFilename } from "@/lib/transcribe/folder-validation";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { assertFolderAccess, assertJobAccess } from "@/lib/auth/file-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const { id } = await params;
      const job = await getTranscribeJob(id);
      if (!job) return error("Not found", 404);
      assertJobAccess(user, job);
      const chunks = await getTranscribeChunks(id);
      let folderName: string | null = null;
      if (job.folderId) {
        const folder = await getTranscribeFolder(job.folderId);
        folderName = folder?.name ?? null;
      }
      return json({ job, chunks, folderName });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const { id } = await params;
      const job = await getTranscribeJob(id);
      if (!job) return error("Not found", 404);
      assertJobAccess(user, job);

      const body = await req.json();
      const patch: Record<string, unknown> = {};

      if (body.filename !== undefined) {
        const filename = normalizeFilename(body.filename);
        if (!filename) return error("Filename must be 1–255 characters", 400);
        patch.filename = filename;
      }

      if (body.folderId !== undefined) {
        if (body.folderId === null) {
          patch.folderId = null;
        } else if (typeof body.folderId === "string") {
          const folder = await getTranscribeFolder(body.folderId);
          if (!folder) return error("Folder not found", 404);
          assertFolderAccess(user, folder);
          patch.folderId = folder.id;
        } else {
          return error("Invalid folderId", 400);
        }
      }

      if (Object.keys(patch).length === 0) {
        return error("No valid fields to update", 400);
      }

      await updateTranscribeJob(id, patch);
      const updated = await getTranscribeJob(id);
      let folderName: string | null = null;
      if (updated?.folderId) {
        const folder = await getTranscribeFolder(updated.folderId);
        folderName = folder?.name ?? null;
      }

      return json({
        job: {
          id: updated!.id,
          filename: updated!.filename,
          folderId: updated!.folderId ?? null,
          folderName,
        },
      });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function DELETE(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const { id } = await params;
      const job = await getTranscribeJob(id);
      if (!job) return error("Not found", 404);
      assertJobAccess(user, job);
      const deleted = await deleteTranscribeJobCompletely(id);
      if (!deleted) return error("Not found", 404);
      return json({ deleted: true, jobId: id });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
