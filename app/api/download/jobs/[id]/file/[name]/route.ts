import { NextRequest } from "next/server";
import { getDownloadArtifacts, getDownloadJob } from "@/lib/db/queries";
import { getRangeStream } from "@/lib/storage/s3";
import { error, handleRoute } from "@/lib/api";

type Params = { params: Promise<{ id: string; name: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id, name } = await params;
    const job = await getDownloadJob(id);
    if (!job) return error("Not found", 404);
    const artifacts = await getDownloadArtifacts(id);
    const artifact = artifacts.find((a) => a.name === decodeURIComponent(name));
    if (!artifact) return error("Not found", 404);

    const range = req.headers.get("range");
    const result = await getRangeStream(artifact.objectKey, range);
    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");
    if (artifact.contentType) headers.set("Content-Type", artifact.contentType);
    headers.set("Content-Length", String(result.contentLength));
    if (result.contentRange) headers.set("Content-Range", result.contentRange);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(artifact.name)}"`,
    );

    return new Response(result.stream as unknown as BodyInit, {
      status: result.statusCode,
      headers,
    });
  });
}
