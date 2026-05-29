import { getTranscribeChunks, getTranscribeJob } from "@/lib/db/queries";
import { getBuffer } from "@/lib/storage/s3";
import { error, handleRoute, json } from "@/lib/api";
import { compileFromChunks, type CompiledTranscript } from "@/lib/transcribe/compiler";

type Params = { params: Promise<{ id: string }> };

async function loadTranscript(jobId: string, transcriptKey: string | null): Promise<CompiledTranscript | null> {
  if (transcriptKey) {
    const buf = await getBuffer(transcriptKey);
    return JSON.parse(buf.toString()) as CompiledTranscript;
  }
  const chunks = await getTranscribeChunks(jobId);
  if (!chunks.some((c) => c.transcript?.trim())) return null;
  return compileFromChunks(chunks);
}

export async function GET(_req: Request, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const job = await getTranscribeJob(id);
    if (!job || job.status !== "completed") return error("Transcript not ready", 404);

    const t = await loadTranscript(id, job.transcriptKey);
    if (!t) return error("Transcript not ready", 404);

    return json({
      jobId: id,
      language: t.language,
      duration: t.duration,
      words: t.words,
      segments: t.segments,
    });
  });
}
