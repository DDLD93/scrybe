import { getTranscribeChunks, getTranscribeJob } from "@/lib/db/queries";
import { getBuffer, putBuffer } from "@/lib/storage/s3";
import { error, handleRoute, json } from "@/lib/api";
import { authErrorResponse } from "@/lib/auth/require-auth";
import { loadJobForUser } from "@/lib/auth/job-guard";
import {
  applySegmentEdits,
  compileFromChunks,
  markdownFromTranscript,
  type CompiledTranscript,
} from "@/lib/transcribe/compiler";

type Params = { params: Promise<{ id: string }> };

type SegmentEdit = { id: number; text: string };

function parseSegmentEdits(body: unknown): SegmentEdit[] | null {
  if (!body || typeof body !== "object") return null;
  const segments = (body as { segments?: unknown }).segments;
  if (!Array.isArray(segments)) return null;
  const edits: SegmentEdit[] = [];
  for (const item of segments) {
    if (!item || typeof item !== "object") return null;
    const { id, text } = item as { id?: unknown; text?: unknown };
    if (typeof id !== "number" || typeof text !== "string") return null;
    edits.push({ id, text });
  }
  return edits;
}

async function loadTranscript(jobId: string, transcriptKey: string | null): Promise<CompiledTranscript | null> {
  if (transcriptKey) {
    const buf = await getBuffer(transcriptKey);
    return JSON.parse(buf.toString()) as CompiledTranscript;
  }
  const chunks = await getTranscribeChunks(jobId);
  if (!chunks.some((c) => c.transcript?.trim())) return null;
  return compileFromChunks(chunks);
}

export async function GET(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const { id } = await params;
      const access = await loadJobForUser(req, id);
      if (!access.ok) return access.response;
      const { job } = access;
      if (job.status !== "completed") return error("Transcript not ready", 404);

      const t = await loadTranscript(id, job.transcriptKey);
      if (!t) return error("Transcript not ready", 404);

      return json({
        jobId: id,
        language: t.language,
        duration: t.duration,
        words: t.words,
        segments: t.segments,
      });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const { id } = await params;
      const access = await loadJobForUser(req, id);
      if (!access.ok) return access.response;
      const { job } = access;
      if (job.status !== "completed") return error("Transcript not ready", 404);
      if (!job.transcriptKey) return error("Transcript not ready", 404);

    const existing = await loadTranscript(id, job.transcriptKey);
    if (!existing) return error("Transcript not ready", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }

    const edits = parseSegmentEdits(body);
    if (!edits) return error("Invalid segments payload", 400);

    const knownIds = new Set(existing.segments.map((s) => s.id));
    for (const edit of edits) {
      if (!knownIds.has(edit.id)) return error(`Unknown segment id: ${edit.id}`, 400);
    }

    const compiled = applySegmentEdits(existing, edits);
    await putBuffer(job.transcriptKey, JSON.stringify(compiled), "application/json");

    if (job.resultKey) {
      const md = markdownFromTranscript(compiled, job.filename, job.model);
      await putBuffer(job.resultKey, md, "text/markdown");
    }

    return json({
      jobId: id,
      language: compiled.language,
      duration: compiled.duration,
      words: compiled.words,
      segments: compiled.segments,
    });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
