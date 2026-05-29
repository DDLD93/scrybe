import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  createTranscribeJob,
  getDownloadArtifacts,
  getDownloadJob,
  upsertTranscribeSettings,
} from "@/lib/db/queries";
import { copyObject } from "@/lib/storage/s3";
import { enqueue } from "@/lib/worker/queue";
import { accepted, error, handleRoute } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id: downloadJobId } = await params;
    const job = await getDownloadJob(downloadJobId);
    if (!job || job.status !== "completed") return error("Download job not completed", 400);

    const artifacts = await getDownloadArtifacts(downloadJobId);
    const media = artifacts.find((a) => a.role === "media");
    if (!media) return error("No media artifact", 400);

    const model = req.nextUrl.searchParams.get("model") ?? "openai/whisper-1";
    const size = req.nextUrl.searchParams.get("size") ?? "30";
    const unit = req.nextUrl.searchParams.get("unit") ?? "seconds";
    const systemPrompt = req.nextUrl.searchParams.get("prompt") ?? undefined;

    const transcribeId = randomUUID();
    const destKey = `jobs/${transcribeId}/source/${media.name}`;
    await copyObject(media.objectKey, destKey);

    await createTranscribeJob({
      id: transcribeId,
      filename: media.name,
      contentType: media.contentType,
      fileSize: media.fileSize,
      chunkUnit: unit === "mb" ? "mb" : "seconds",
      chunkSize: size,
      model,
      systemPrompt,
      sourceKey: destKey,
    });

    await upsertTranscribeSettings({
      chunkUnit: unit,
      chunkSize: size,
      model,
      systemPrompt,
    });
    enqueue({ type: "transcribe", jobId: transcribeId });
    return accepted({ jobId: transcribeId, downloadJobId });
  });
}
