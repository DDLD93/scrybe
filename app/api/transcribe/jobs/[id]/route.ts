import { NextRequest } from "next/server";
import { getTranscribeChunks, getTranscribeJob } from "@/lib/db/queries";
import { getBuffer, getRangeStream, getStream } from "@/lib/storage/s3";
import { error, handleRoute, json } from "@/lib/api";
import type { CompiledTranscript } from "@/lib/transcribe/compiler";

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
