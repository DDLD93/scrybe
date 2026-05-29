import { NextRequest } from "next/server";
import { getTranscribeChunks, getTranscribeJob } from "@/lib/db/queries";
import { error, handleRoute, json } from "@/lib/api";
import { deleteTranscribeJobCompletely } from "@/lib/transcribe/cleanup";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job) return error("Not found", 404);
    const chunks = await getTranscribeChunks(id);
    return json({ job, chunks });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const deleted = await deleteTranscribeJobCompletely(id);
    if (!deleted) return error("Not found", 404);
    return json({ deleted: true, jobId: id });
  });
}
