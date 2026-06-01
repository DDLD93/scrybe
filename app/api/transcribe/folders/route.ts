import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  createTranscribeFolder,
  findTranscribeFolderByName,
  listTranscribeFolders,
} from "@/lib/db/queries";
import { normalizeFolderName } from "@/lib/transcribe/folder-validation";
import { error, handleRoute, json } from "@/lib/api";

export async function GET() {
  return handleRoute(async () => {
    const folders = await listTranscribeFolders();
    return json({
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        jobCount: f.jobCount,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await req.json();
    const name = normalizeFolderName(body.name);
    if (!name) return error("Folder name must be 1–100 characters", 400);

    const existing = await findTranscribeFolderByName(name);
    if (existing) return error("A folder with this name already exists", 409);

    const folder = await createTranscribeFolder({ id: randomUUID(), name });
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
  });
}
