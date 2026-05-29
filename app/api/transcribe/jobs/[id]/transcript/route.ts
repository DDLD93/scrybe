import { getTranscribeJob } from "@/lib/db/queries";
import { getBuffer } from "@/lib/storage/s3";
import { error, handleRoute, json } from "@/lib/api";
import type { CompiledTranscript } from "@/lib/transcribe/compiler";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job || job.status !== "completed") return error("Transcript not ready", 404);
    if (!job.transcriptKey) return error("Transcript not ready", 404);

    const buf = await getBuffer(job.transcriptKey);
    const t = JSON.parse(buf.toString()) as CompiledTranscript;
    return json({
      jobId: id,
      language: t.language,
      duration: t.duration,
      words: t.words,
      segments: t.segments,
    });
  });
}
