import { NextRequest } from "next/server";
import { getDownloadArtifacts, getDownloadJob } from "@/lib/db/queries";
import { error, handleRoute, json } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getDownloadJob(id);
    if (!job) return error("Not found", 404);
    const artifacts = await getDownloadArtifacts(id);
    return json({
      id: job.id,
      url: job.url,
      status: job.status,
      progress: job.progressJson,
      artifacts: artifacts.map((a) => ({
        name: a.name,
        key: a.objectKey,
        size: a.fileSize,
        contentType: a.contentType,
        role: a.role,
      })),
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  });
}
