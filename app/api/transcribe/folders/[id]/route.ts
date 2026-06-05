import { NextRequest } from "next/server";
import {
  deleteTranscribeFolder,
  findTranscribeFolderByName,
  getTranscribeFolder,
  updateTranscribeFolder,
} from "@/lib/db/queries";
import { normalizeFolderName } from "@/lib/transcribe/folder-validation";
import { error, handleRoute, json } from "@/lib/api";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { assertFolderAccess, getFileScope } from "@/lib/auth/file-access";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const scope = getFileScope(user);
      const { id } = await params;
      const folder = await getTranscribeFolder(id);
      if (!folder) return error("Not found", 404);
      assertFolderAccess(user, folder);

      const body = await req.json();
      const name = normalizeFolderName(body.name);
      if (!name) return error("Folder name must be 1–100 characters", 400);

      const existing = await findTranscribeFolderByName(name, id, scope);
      if (existing) return error("A folder with this name already exists", 409);

      const updated = await updateTranscribeFolder(id, { name });
      return json({
        folder: {
          id: updated!.id,
          name: updated!.name,
          createdAt: updated!.createdAt.toISOString(),
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
      const scope = getFileScope(user);
      const { id } = await params;
      const folder = await getTranscribeFolder(id);
      if (!folder) return error("Not found", 404);
      assertFolderAccess(user, folder);

      const result = await deleteTranscribeFolder(id, scope);
      if (result === "not_found") return error("Not found", 404);
      if (result === "not_empty") {
        return error("Folder is not empty. Move or delete transcripts first.", 409);
      }
      return json({ deleted: true, id });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
