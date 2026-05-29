import { NextRequest } from "next/server";
import type { DownloadJobOptions } from "@/lib/download/argv-builder";
import { validateDownloadUrl } from "@/lib/download/ssrf";
import { contentDispositionAttachment, createYtdlpDownloadStream } from "@/lib/download/stream";
import { config } from "@/lib/config";
import { error, handleRoute } from "@/lib/api";

export const maxDuration = config.downloadJobTimeoutSec;

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await req.json();
    const url = body.url as string | undefined;
    if (!url) return error("Missing url");

    const options = (body.options ?? {}) as DownloadJobOptions;
    if (options.playlistItems) {
      return error("Playlist items are not supported for stream downloads", 400);
    }

    const safe = await validateDownloadUrl(url);
    const { body: stream, contentType, filename } = await createYtdlpDownloadStream({
      url: safe,
      preset: body.preset ?? null,
      options,
      signal: req.signal,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDispositionAttachment(filename),
      },
    });
  });
}
