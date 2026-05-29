import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createDownloadJob, getDownloadArtifacts, getDownloadJob, listDownloadJobs, updateDownloadJob } from "@/lib/db/queries";
import type { DownloadJobOptions } from "@/lib/download/argv-builder";
import { validateDownloadUrl } from "@/lib/download/ssrf";
import { enqueue } from "@/lib/worker/queue";
import { accepted, error, handleRoute, json } from "@/lib/api";

export async function GET() {
  return handleRoute(async () => {
    const jobs = await listDownloadJobs(200);
    const withArtifacts = await Promise.all(
      jobs.map(async (job) => {
        const artifacts = await getDownloadArtifacts(job.id);
        return formatJob(job, artifacts);
      }),
    );
    return json({ jobs: withArtifacts });
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await req.json();
    const url = body.url as string | undefined;
    if (!url) return error("Missing url");
    const safe = await validateDownloadUrl(url);
    const id = randomUUID();
    await createDownloadJob({
      id,
      url: safe,
      preset: body.preset ?? null,
      optionsJson: (body.options ?? {}) as DownloadJobOptions,
    });
    enqueue({ type: "download", jobId: id });
    return accepted({ jobId: id });
  });
}

function formatJob(
  job: NonNullable<Awaited<ReturnType<typeof getDownloadJob>>>,
  artifacts: Awaited<ReturnType<typeof getDownloadArtifacts>>,
) {
  return {
    id: job.id,
    url: job.url,
    preset: job.preset,
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
  };
}

export { formatJob };
