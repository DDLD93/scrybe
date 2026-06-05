import { NextRequest } from "next/server";
import { getRangeStream } from "@/lib/storage/s3";
import { error, handleRoute } from "@/lib/api";
import { authErrorResponse } from "@/lib/auth/require-auth";
import { loadJobForUser } from "@/lib/auth/job-guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    try {
      const { id } = await params;
      const access = await loadJobForUser(req, id);
      if (!access.ok) return access.response;
      const { job } = access;
      if (!job.playbackKey) {
        return error("Audio not ready", 404);
      }

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
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
