import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { finished } from "stream/promises";
import { mkdtemp, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { config } from "@/lib/config";
import { createTranscribeJob, listTranscribeJobs, upsertTranscribeSettings } from "@/lib/db/queries";
import { putFile } from "@/lib/storage/s3";
import { enqueue } from "@/lib/worker/queue";
import { accepted, error, handleRoute, json } from "@/lib/api";

function toJobSummary(job: Awaited<ReturnType<typeof listTranscribeJobs>>[number]) {
  return {
    id: job.id,
    filename: job.filename,
    model: job.model,
    status: job.status,
    totalChunks: job.totalChunks,
    completedChunks: job.completedChunks,
    error: job.error,
    hasWordTimings: job.hasWordTimings,
  };
}

export async function GET() {
  return handleRoute(async () => {
    const jobs = await listTranscribeJobs(200);
    return json({ jobs: jobs.map(toJobSummary) });
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const sp = req.nextUrl.searchParams;
    const filename = (sp.get("filename") ?? "audio.mp3").replace(/[\\/]/g, "_");
    const unit = sp.get("unit") === "mb" ? "mb" : "seconds";
    const sizeRaw = sp.get("size");
    const model = sp.get("model");
    const prompt = sp.get("prompt");

    if (!sizeRaw) return error("Missing 'size'");
    if (!model) return error("Missing 'model'");
    const size = parseFloat(sizeRaw);
    if (!Number.isFinite(size) || size <= 0) return error("Invalid 'size'");

    const contentType = req.headers.get("content-type") ?? "application/octet-stream";
    const jobId = randomUUID();
    const dir = await mkdtemp(join(tmpdir(), "scrybe-upload-"));
    const tempPath = join(dir, filename);

    let written = 0;
    const out = createWriteStream(tempPath);
    const body = req.body;
    if (!body) return error("Empty upload");

    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        written += value.length;
        if (written > config.transcribeUploadMaxBytes) {
          return error("Upload exceeds 1 GB limit");
        }
        await new Promise<void>((resolve, reject) => {
          out.write(value, (err) => (err ? reject(err) : resolve()));
        });
      }
    } finally {
      out.end();
    }

    if (written === 0) return error("Empty upload");

    await finished(out);

    const sourceKey = `jobs/${jobId}/source/${filename}`;
    await putFile(sourceKey, tempPath, contentType);
    await unlink(tempPath).catch(() => {});

    await createTranscribeJob({
      id: jobId,
      filename,
      contentType,
      fileSize: written,
      chunkUnit: unit,
      chunkSize: String(size),
      model,
      systemPrompt: prompt,
      sourceKey,
    });

    await upsertTranscribeSettings({
      chunkUnit: unit,
      chunkSize: String(size),
      model,
      systemPrompt: prompt,
    });

    enqueue({ type: "transcribe", jobId });
    return accepted({ jobId });
  });
}
