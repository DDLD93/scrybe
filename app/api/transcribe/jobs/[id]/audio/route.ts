import { NextRequest } from "next/server";
import { getTranscribeJob } from "@/lib/db/queries";
import { getRangeStream } from "@/lib/storage/s3";
import { error, handleRoute } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job?.playbackKey) return error("Audio not ready", 404);

    const range = req.headers.get("range");
    const result = await getRangeStream(job.playbackKey, range);
    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Type", job.playbackContentType ?? "audio/mp4");
    headers.set("Content-Length", String(result.contentLength));
    if (result.contentRange) headers.set("Content-Range", result.contentRange);

    return new Response(result.stream as unknown as BodyInit, {
      status: result.statusCode,
      headers,
    });
  });
}
