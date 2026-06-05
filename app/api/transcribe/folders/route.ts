import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  createTranscribeFolder,
  findTranscribeFolderByName,
  listTranscribeFolders,
} from "@/lib/db/queries";
import { normalizeFolderName } from "@/lib/transcribe/folder-validation";
import { error, handleRoute, json } from "@/lib/api";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { getFileScope } from "@/lib/auth/file-access";

export async function GET(req: Request) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const scope = getFileScope(user);
      const folders = await listTranscribeFolders(scope);
      return json({
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          jobCount: f.jobCount,
          createdAt: f.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    try {
      const user = await requireAuth(req);
      const scope = getFileScope(user);
      const body = await req.json();
      const name = normalizeFolderName(body.name);
      if (!name) return error("Folder name must be 1–100 characters", 400);

      const existing = await findTranscribeFolderByName(name, undefined, scope);
      if (existing) return error("A folder with this name already exists", 409);

      const folder = await createTranscribeFolder({
        id: randomUUID(),
        name,
        createdByUserId: user.id,
      });
      return json(
        {
          folder: {
            id: folder.id,
            name: folder.name,
            jobCount: 0,
            createdAt: folder.createdAt.toISOString(),
          },
        },
        201,
      );
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
